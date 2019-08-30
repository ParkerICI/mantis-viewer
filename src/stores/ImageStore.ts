import { observable, action, autorun } from 'mobx'
import * as path from 'path'

import { ImageData } from '../lib/ImageData'
import { SegmentationData } from '../lib/SegmentationData'
import { SegmentationStatistics } from '../lib/SegmentationStatistics'
import { ImageChannels, ChannelName } from '../definitions/UIDefinitions'

export class ImageStore {
    public constructor() {
        this.initialize()
    }

    @observable.ref public imageData: ImageData | null
    @observable public imageDataLoading: boolean

    @observable public imageExportFilename: string | null

    @observable.ref public segmentationData: SegmentationData | null
    @observable public segmentationDataLoading: boolean
    @observable.ref public segmentationStatistics: SegmentationStatistics | null

    @observable public selectedDirectory: string | null
    @observable public selectedSegmentationFile: string | null

    @observable public channelDomain: Record<ChannelName, [number, number]>
    @observable public channelVisibility: Record<ChannelName, boolean>

    @observable.ref public markerSelectOptions: { value: string; label: string }[]

    @observable public segmentationFillAlpha: number
    @observable public segmentationOutlineAlpha: number
    @observable public segmentationCentroidsVisible: boolean

    @observable public channelMarker: Record<ChannelName, string | null>

    @observable public currentSelection: {
        x: [number, number]
        y: [number, number]
    } | null

    private calculateSegmentationStatistics = autorun(() => {
        if (this.imageData && this.segmentationData) {
            let statistics = new SegmentationStatistics(this.setSegmentationStatistics)
            statistics.generateStatistics(this.imageData, this.segmentationData)
        } else {
            this.setSegmentationStatistics(null)
        }
    })

    private setMarkerSelectOptions = autorun(() => {
        if (this.imageData) {
            this.updateMarkerSelectOption()
        }
    })

    @action private initialize = () => {
        this.channelDomain = {
            rChannel: [0, 100],
            gChannel: [0, 100],
            bChannel: [0, 100],
            cChannel: [0, 100],
            mChannel: [0, 100],
            yChannel: [0, 100],
            kChannel: [0, 100],
        }

        this.channelVisibility = {
            rChannel: true,
            gChannel: true,
            bChannel: true,
            cChannel: true,
            mChannel: true,
            yChannel: true,
            kChannel: true,
        }

        this.markerSelectOptions = []

        this.initializeSegmentationSettings()

        this.channelMarker = {
            rChannel: null,
            gChannel: null,
            bChannel: null,
            cChannel: null,
            mChannel: null,
            yChannel: null,
            kChannel: null,
        }

        this.imageDataLoading = false
        this.segmentationDataLoading = false
    }

    @action public setImageDataLoading = (status: boolean) => {
        this.imageDataLoading = status
    }

    @action public setImageData = (data: ImageData) => {
        this.imageData = data
        // Segmentation data might have finished loading while image data was loading.
        // If this happens the segmentation file won't get removed from image data.
        // So we want to check and remove segmentation once image data is set.
        this.removeSegmentationFileFromImageData()
        this.setImageDataLoading(false)
    }

    @action public clearImageData = () => {
        this.imageData = null
    }

    @action public setSegmentationFillAlpha = (value: number) => {
        this.segmentationFillAlpha = value
    }

    @action public setSegmentationOutlineAlpha = (value: number) => {
        this.segmentationOutlineAlpha = value
    }

    @action public setCentroidVisibility = (visible: boolean) => {
        this.segmentationCentroidsVisible = visible
    }

    @action public setChannelVisibility = (name: ChannelName, visible: boolean) => {
        this.channelVisibility[name] = visible
    }

    public getChannelDomainPercentage = (name: ChannelName) => {
        let percentages: [number, number] = [0, 1]

        if (this.imageData != null) {
            let channelMarker = this.channelMarker[name]
            if (channelMarker != null) {
                let channelMax = this.imageData.minmax[channelMarker].max
                let minPercentage = this.channelDomain[name][0] / channelMax
                let maxPercentage = this.channelDomain[name][1] / channelMax
                percentages = [minPercentage, maxPercentage]
            }
        }

        return percentages
    }

    @action public setChannelDomain = (name: ChannelName, domain: [number, number]) => {
        // Only set the domain if min is less than the max oherwise WebGL will crash
        if (domain[0] < domain[1]) this.channelDomain[name] = domain
    }

    @action public setChannelDomainFromPercentage = (name: ChannelName, domain: [number, number]) => {
        let channelMarker = this.channelMarker[name]
        if (this.imageData != null && channelMarker != null) {
            let channelMax = this.imageData.minmax[channelMarker].max
            let minValue = domain[0] * channelMax
            let maxValue = domain[1] * channelMax
            this.channelDomain[name] = [minValue, maxValue]
        }
    }

    @action public unsetChannelMarker = (channelName: ChannelName) => {
        this.channelMarker[channelName] = null
        this.channelDomain[channelName] = [0, 100]
    }

    @action public setChannelMarker = (channelName: ChannelName, markerName: string) => {
        this.channelMarker[channelName] = markerName
        // Setting the default slider/domain values to the min/max values from the image
        if (this.imageData != null) {
            let min = this.imageData.minmax[markerName].min
            let max = this.imageData.minmax[markerName].max
            this.channelDomain[channelName] = [min, max]
        }
    }

    @action public selectDirectory = (dirName: string) => {
        this.selectedDirectory = dirName
        this.refreshImageData()
    }

    @action public refreshImageData = () => {
        if (this.selectedDirectory != null && this.imageData == null) {
            this.setImageDataLoading(true)
            let imageData = new ImageData()
            // Load image data in the background and set on the image store once it's loaded.
            imageData.loadFolder(this.selectedDirectory, data => {
                this.setImageData(data)
            })
        }
    }

    @action public setSegmentationStatistics = (statistics: SegmentationStatistics | null) => {
        this.segmentationStatistics = statistics
    }

    @action public clearSegmentationStatistics = () => {
        this.segmentationStatistics = null
    }

    @action public removeMarker = (markerName: string) => {
        if (this.imageData != null && markerName in this.imageData.data) {
            // Unset the marker if it is being used
            for (let s of ImageChannels) {
                let curChannel = s as ChannelName
                if (this.channelMarker[curChannel] == markerName) this.unsetChannelMarker(curChannel)
            }
            // Delete it from image data
            this.imageData.removeMarker(markerName)
            this.updateMarkerSelectOption()
        }
    }

    @action private initializeSegmentationSettings = () => {
        this.segmentationFillAlpha = 0
        this.segmentationOutlineAlpha = 0.7
        this.segmentationCentroidsVisible = false
    }

    @action private setSegmentationDataLoadingStatus = (status: boolean) => {
        this.segmentationDataLoading = status
    }

    @action private setSegmentationData = (data: SegmentationData) => {
        this.segmentationData = data
        this.setSegmentationDataLoadingStatus(false)
    }

    // Deletes the segmentation data and resets the selected segmentation file and alpha
    @action public clearSegmentationData = () => {
        this.selectedSegmentationFile = null
        this.initializeSegmentationSettings()
        this.deleteSegmentationData()
    }

    // Just deletes the associated segmentation data.
    // Used in clearSegmentationData
    // And when cleaning up memory in the projectStore.
    @action public deleteSegmentationData = () => {
        this.segmentationData = null
    }

    @action public refreshSegmentationData = () => {
        if (this.selectedSegmentationFile != null && this.segmentationData == null) {
            this.setSegmentationDataLoadingStatus(true)
            let segmentationData = new SegmentationData()
            segmentationData.loadFile(this.selectedSegmentationFile, this.setSegmentationData)
        }
    }

    @action public setSegmentationFile = (fName: string) => {
        this.selectedSegmentationFile = fName
        this.refreshSegmentationData()
        this.removeSegmentationFileFromImageData()
    }

    @action public removeSegmentationFileFromImageData = () => {
        if (this.selectedSegmentationFile != null) {
            let basename = path.parse(this.selectedSegmentationFile).name
            this.removeMarker(basename)
        }
    }

    @action public setImageExportFilename = (fName: string) => {
        this.imageExportFilename = fName
    }

    @action public clearImageExportFilename = () => {
        this.imageExportFilename = null
    }

    // Somewhat hacky feeling workaround
    // markerSelectOptions used to be computed, but was not refreshing when a marker was being removed (for segmentation data)
    // Moved it here so that it can be called manually when we remove the segmentation data tiff from image data.
    @action public updateMarkerSelectOption = () => {
        if (this.imageData) {
            this.markerSelectOptions = this.imageData.markerNames.map(s => {
                return { value: s, label: s }
            })
        } else {
            this.markerSelectOptions = []
        }
    }
}
