import { SegmentationData } from "./SegmentationData"
import { ImageData } from "./ImageData"
import { SegmentationStatisticWorkerResult } from "../interfaces/ImageInterfaces"

import StatisticWorker = require("worker-loader?name=dist/[name].js!../workers/SegmentationStatisticsWorker")

export class SegmentationStatistics {
    // Map of channel/marker names plus segment id (channel_segmentid) the median intensity for that channel and segment
    meanMap: Record<string, number>
    // Map of channel/marker names plus segment id (channel_segmentid) the median intensity for that channel and segment
    medianMap: Record<string,number>
    
    // Keep track of the number of channels to calculate statistics for and the number complete
    private numWorkers: number
    private numWorkersComplete: number
    // Array of the workers
    private workers: StatisticWorker[]
    // Callback function to call with the built ImageData once it has been loaded.
    private onReady: (statistics: SegmentationStatistics) => void

    private statisticsLoadComplete() {
        // If the number of channels loaded is equal to the total number of channels we are done!
        if(this.numWorkersComplete == this.numWorkers){
            this.onReady(this)
        }
    } 

    private async loadStatisticData(data: SegmentationStatisticWorkerResult){
        if(data.statistic == 'mean') {
            for(let key in data.map){
                this.meanMap[key] = data.map[key]
            }
        } else if(data.statistic == 'median') {
            for(let key in data.map){
                this.medianMap[key] = data.map[key]
            }
        }
        this.numWorkersComplete += 1
        this.statisticsLoadComplete()
    }

    private loadInWorker(message: any, onReady: (statistics: SegmentationStatistics) => void) {
        this.onReady = onReady

        let loadStatisticData = (data: SegmentationStatisticWorkerResult) => this.loadStatisticData(data)

        let worker = new StatisticWorker()
        worker.addEventListener('message', function(e: {data: SegmentationStatisticWorkerResult}) {
            loadStatisticData(e.data)
        }, false)

        worker.postMessage(message)

        this.workers.push(worker)
    }

    generateStatistics(imageData: ImageData, segmentationData: SegmentationData, onReady: (statistics: SegmentationStatistics) => void) {
        for(let channel in imageData.data){
            this.numWorkers += 2
            let tiffData = imageData.data[channel]
            this.loadInWorker({channel: channel, tiffData: tiffData, segmentIndexMap: segmentationData.segmentIndexMap, statistic: 'mean'}, onReady)
            this.loadInWorker({channel: channel, tiffData: tiffData, segmentIndexMap: segmentationData.segmentIndexMap, statistic: 'median'}, onReady)
        }
    }

    constructor() {
        this.numWorkers = 0
        this.numWorkersComplete = 0
        this.workers = []
        this.meanMap = {}
        this.medianMap = {}
    }

}