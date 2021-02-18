/* eslint @typescript-eslint/no-explicit-any: 0 */
//Typescript workaround so that we're interacting with a Worker instead of a Window interface
const ctx: Worker = self as any

import { Db } from '../lib/Db'
import { parseSegmentDataCSV } from '../lib/IO'
import { SegmentFeatureDbRequest, SegmentFeatureDbResult, ImageSetFeatureResult } from './SegmentFeatureDbWorker'
import { MinMax } from '../interfaces/ImageInterfaces'

// Globals to keep db connection
let basePath: string
let db: Db
// Globals to cache feature values and min maxes
let featureValues: Record<string, Record<string, Record<number, number>>>
let featureMinMaxes: Record<string, Record<string, MinMax>>

function initializeDb(dbPath: string): void {
    if (basePath != dbPath) {
        basePath = dbPath
        db = new Db(basePath)
        featureValues = {}
        featureMinMaxes = {}
    }
}

function importSegmentFeaturesFromCSV(
    dbPath: string,
    filePath: string,
    validImageSets: string[],
    imageSetName: string | undefined,
    clearDuplicates: boolean,
): SegmentFeatureDbResult {
    initializeDb(dbPath)
    const invalidImageSets: string[] = []
    const parsed = parseSegmentDataCSV(filePath, imageSetName)
    const segmentData = parsed.data
    const segmentInfo = parsed.info
    for (const imageSet of Object.keys(segmentData)) {
        if (validImageSets.includes(imageSet)) {
            const imageSetData = segmentData[imageSet]
            for (const feature of Object.keys(imageSetData)) {
                const segmentValues = imageSetData[feature]
                if (clearDuplicates) db.deleteFeatures(imageSet, feature)
                db.insertFeatures(imageSet, feature, segmentValues)
            }
        } else {
            if (!invalidImageSets.includes(imageSet)) invalidImageSets.push(imageSet)
        }
    }
    return {
        importedFeatures: segmentInfo.validFeatures,
        totalFeatures: segmentInfo.totalFeatures,
        invalidFeatureNames: segmentInfo.invalidFeatureNames,
        invalidImageSets: invalidImageSets,
    }
}

function getFeatureValues(
    dbPath: string,
    requestedFeatures: { feature: string; imageSetName: string }[],
): SegmentFeatureDbResult {
    initializeDb(dbPath)
    const results: ImageSetFeatureResult[] = []
    for (const feature of requestedFeatures) {
        const curImageSet = feature.imageSetName
        const curFeature = feature.feature

        if (!(curImageSet in featureValues)) featureValues[curImageSet] = {}
        if (!(curFeature in featureValues[curImageSet]))
            featureValues[curImageSet][curFeature] = db.selectValues([curImageSet], curFeature)[curImageSet]

        if (!(curImageSet in featureMinMaxes)) featureMinMaxes[curImageSet] = {}
        if (!(curFeature in featureMinMaxes[curImageSet]))
            featureMinMaxes[curImageSet][curFeature] = db.minMaxValues([curImageSet], curFeature)[curImageSet]

        if (featureValues[curImageSet][curFeature] && featureMinMaxes[curImageSet][curFeature]) {
            results.push({
                feature: curFeature,
                imageSetName: curImageSet,
                values: featureValues[curImageSet][curFeature],
                minMax: featureMinMaxes[curImageSet][curFeature],
            })
        }
    }

    return {
        basePath: basePath,
        featureResults: results,
    }
}

function getFeaturesAvailable(dbPath: string, imageSetName: string): SegmentFeatureDbResult {
    initializeDb(dbPath)
    return { imageSetName: imageSetName, features: db.listFeatures(imageSetName) }
}

ctx.addEventListener(
    'message',
    (message) => {
        const input: SegmentFeatureDbRequest = message.data
        let results: SegmentFeatureDbResult
        // try {
        if ('filePath' in input) {
            results = importSegmentFeaturesFromCSV(
                input.basePath,
                input.filePath,
                input.validImageSets,
                input.imageSetName,
                input.clearDuplicates,
            )
        } else if ('requestedFeatures' in input) {
            // Request to get values for feature for passed in image set
            results = getFeatureValues(input.basePath, input.requestedFeatures)
        } else if ('imageSetName' in input) {
            // Request to list features available for the passed in image set
            results = getFeaturesAvailable(input.basePath, input.imageSetName)
        } else {
            results = { error: 'Invalid request' }
        }
        // } catch (err) {
        //     results = { error: err.message }
        // }
        ctx.postMessage(results)
    },
    false,
)
