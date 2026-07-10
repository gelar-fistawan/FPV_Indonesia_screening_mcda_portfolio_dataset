// =====================================================
// BATCH 4: JRC MATCHING FOR CORRECTED CORE CANDIDATES >=10 KM2
// Upload 08_core_candidates_ge10km2_geometry_shapefile.zip to GEE Assets first.
// Replace the asset ID below with your uploaded asset ID.
// =====================================================

var candidates = ee.FeatureCollection('PASTE_YOUR_ASSET_ID_HERE');

var jrc = ee.Image('JRC/GSW1_4/GlobalSurfaceWater');
var occurrence = jrc.select('occurrence');
var seasonality = jrc.select('seasonality');

// Preliminary threshold only, not final manuscript threshold.
var stableWater = occurrence.gte(80).and(seasonality.gte(10));

var stableWaterArea = ee.Image.pixelArea()
  .divide(1000000)
  .rename('jrc_stable_water_area_km2')
  .updateMask(stableWater);

var results = candidates.map(function(feature) {
  var geom = feature.geometry();

  var stableArea = ee.Number(stableWaterArea.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geom,
    scale: 30,
    maxPixels: 1e13
  }).get('jrc_stable_water_area_km2'));

  var meanOccurrence = occurrence.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geom,
    scale: 30,
    maxPixels: 1e13
  }).get('occurrence');

  var meanSeasonality = seasonality.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geom,
    scale: 30,
    maxPixels: 1e13
  }).get('seasonality');

  // sel_area is selected screening area from the uploaded shapefile.
  var sourceArea = ee.Number.parse(feature.get('sel_area'));

  var areaDiffPercent = stableArea.subtract(sourceArea)
    .divide(sourceArea)
    .multiply(100);

  var matchStatus = ee.Algorithms.If(
    stableArea.gt(0),
    'JRC_MATCH_FOUND',
    'NO_STABLE_WATER_MATCH'
  );

  return feature.set({
    'jrc_stable_water_area_km2': stableArea,
    'jrc_mean_occurrence': meanOccurrence,
    'jrc_mean_seasonality': meanSeasonality,
    'area_difference_percent': areaDiffPercent,
    'jrc_match_status': matchStatus,
    'jrc_threshold_occurrence': 80,
    'jrc_threshold_seasonality': 10,
    'jrc_status': 'PRELIMINARY_CORE_MATCH'
  });
});

Map.centerObject(candidates, 5);
Map.addLayer(candidates, {color: 'red'}, 'Corrected core candidates >=10 km2');
Map.addLayer(stableWater.selfMask(), {palette: ['0000ff']}, 'JRC stable water mask');

print('Corrected core candidate count:', candidates.size());
print('JRC core matching results:', results.limit(10));

Export.table.toDrive({
  collection: results,
  description: 'core_candidates_jrc_match_results',
  fileFormat: 'CSV'
});
