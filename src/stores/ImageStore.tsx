import { observable, 
    computed, 
    action } from "mobx"
import { IMCData } from "../lib/IMCData"
import { IMCImageROI } from "../components/IMCIMage"
import { SegmentationData } from "../lib/SegmentationData"
import { ScatterPlotData } from "../lib/ScatterPlotData"
import * as _ from "underscore"
import { ChannelName,
    PlotStatistic, 
    D3BrushExtent, 
    SelectOption,
    LabelLayer } from "../interfaces/UIDefinitions"
import { keepAlive, IDisposer } from "mobx-utils"

export class ImageStore {

    selectedDataDisposer: IDisposer

    constructor() {
        this.selectedDataDisposer = keepAlive(this.selectedData)
    }

    private canvasImageData:ImageData | null = null

    @observable windowWidth: number | null
    @observable windowHeight: number | null
    
    @observable.ref imageData: IMCData | null

    @observable.ref segmentationData: SegmentationData | null

    @observable regionsOfInterest: Array<IMCImageROI> | null

    @observable scatterPlotData: ScatterPlotData | null
    @observable scatterPlotStatistic: PlotStatistic = "median"

    @observable.ref extraData: Uint8ClampedArray | null = null

    @observable selectedFile: string | null
    @observable selectedDirectory: string | null
    @observable selectedSegmentationFile: string | null
    @observable.ref selectedPlotChannels: string[] = []
    
    @observable channelDomain: Record<ChannelName, [number, number]> = {
        rChannel: [0, 100],
        gChannel: [0, 100],
        bChannel: [0, 100]
    }
    @observable channelSliderValue: Record<ChannelName, [number, number]> = {
        rChannel: [0, 100],
        gChannel: [0, 100],
        bChannel: [0, 100]
    }

    @observable segmentationAlpha: number = 5

    @observable channelMarker: Record<ChannelName, string | null> = {
        rChannel: null,
        gChannel: null,
        bChannel: null
    }

    @observable currentSelection: {
        x: [number, number]
        y: [number, number]
    } | null = null

    labelsLayers = observable.shallowArray<LabelLayer>()

    selectedData = computed(() => {
        console.log("Selecting data")
        let ret: { [x: string]: number[] } = {}

        if (this.imageData != null && this.currentSelection != null) {
            let data = this.imageData.data
            let channelNames = this.imageData.channelNames
            ret = { X: [], Y: [] }
            channelNames.forEach((s) => ret![s] = [])

            for (let i = 0; i < data.X.length; ++i) {
                let x = data.X[i]
                let y = data.Y[i]
                if (x >= this.currentSelection.x[0] && x <= this.currentSelection.x[1])
                    if (y >= this.currentSelection.y[0] && y <= this.currentSelection.y[1])
                        channelNames.forEach((s) => ret![s].push(data[s][i]))
            }
        }
        return (ret)
    })

    @action setWindowDimensions = (width: number, height: number) => {
        this.windowWidth = width
        this.windowHeight = height
    }

    @action toggleLayerVisibility = (idx: number) => {
        console.log(this.labelsLayers[idx].visible)

        console.log(idx)
        this.labelsLayers[idx].visible = !this.labelsLayers[idx].visible
    }

    @action setCurrentSelection(extent: D3BrushExtent) {
        this.currentSelection = {
            x: [extent[0][0], extent[1][0]],
            y: [extent[0][1], extent[1][1]]
        }
    }

    @action updateImageData() {
        if (this.selectedDirectory != null) {
            this.imageData = new IMCData(this.selectedDirectory, "folder")
        }
        
        console.log(this.imageData)
    }

    @action updateSegmentationData() {
        if (this.selectedSegmentationFile != null) {
            this.segmentationData = new SegmentationData(this.selectedSegmentationFile)
        }
    }

    @action setSegmentationSliderValue = () => {
        return action((value: number) => {
            this.segmentationAlpha = value
        })
    }

    @action clearSegmentationData = () => {
        return action(() => {
            this.selectedSegmentationFile = null
            this.segmentationData = null
            this.segmentationAlpha = 5
            this.selectedPlotChannels = []
            this.scatterPlotData = null
        })
    }

    @action addRegionOfInterest = (region: IMCImageROI) => {
        if (this.regionsOfInterest == null) this.regionsOfInterest = new Array<IMCImageROI>()
        this.regionsOfInterest.push(region)
        this.refreshScatterPlotData()
    }

    @action deleteRegionOfInterest = (id: string) => {
        if(this.regionsOfInterest != null){
            this.regionsOfInterest = this.regionsOfInterest.filter(region => region.id != id);
            this.refreshScatterPlotData()
        }
    }

    @action updateRegionOfInterestName = (id: string, newName:string) => {
        if(this.regionsOfInterest != null){
            this.regionsOfInterest = this.regionsOfInterest.map(function(region) {
                if(region.id == id){
                    region.name = newName
                    return region
                }
                else {
                    return region
                }
            })
            this.refreshScatterPlotData()
        }
    }

    @action updateRegionOfInterestNotes = (id: string, newNotes:string) => {
        if(this.regionsOfInterest != null){
            this.regionsOfInterest = this.regionsOfInterest.map(function(region) {
                if(region.id == id){
                    region.notes = newNotes
                    return region
                }
                else {
                    return region
                }
            })
        }
    }

    @action setChannelDomain = (name: ChannelName) => {
        return action((value: [number, number]) => {
            this.channelDomain[name] = value
        })
    }

    @action setChannelSliderValue = (name: ChannelName) => {
        return action((value: [number, number]) => {
            this.channelSliderValue[name] = value
        })
    }

    @action setChannelMarker = (name: ChannelName) => {
        return action((x: SelectOption) => {
            // If the SelectOption has a value.
            if(x != null){
                this.channelMarker[name] = x.value
                // Setting the default slider/domain values to the min/max values from the image
                if(this.imageData != null){
                    let min = this.imageData.minmax[x.value].min
                    let max = this.imageData.minmax[x.value].max
                    this.channelDomain[name] = [min, max]
                    this.channelSliderValue[name] = [min, max]
                }
            // If SelectOption doesn't have a value the channel has been cleared and values should be reset.
            } else {
                this.channelMarker[name] = null
                this.channelDomain[name] = [0, 100]
                this.channelSliderValue[name] = [0, 100]
            }
        })
    }

    @action refreshScatterPlotData = () => {
        if(this.selectedPlotChannels.length == 2){
            let ch1 = this.selectedPlotChannels[0]
            let ch2 = this.selectedPlotChannels[1]
            if(this.imageData != null && this.segmentationData != null){
                this.scatterPlotData = new ScatterPlotData(ch1,
                    ch2,
                    this.imageData,
                    this.segmentationData,
                    this.scatterPlotStatistic,
                    this.regionsOfInterest
                )
            }
        } else {
            this.scatterPlotData = null
        }
    }

    @action setSelectedPlotChannels = (x: SelectOption[]) => {
        this.selectedPlotChannels = _.pluck(x, "value")
        this.refreshScatterPlotData()
    }

    @action setScatterPlotStatistic = (x: SelectOption) => {
        if (x != null){
            this.scatterPlotStatistic = x.value as PlotStatistic
            this.refreshScatterPlotData()
        }
    }    

    @action selectFile = (fName: string) => {
        this.selectedFile = fName
        this.updateImageData()
    }

    @action selectDirectory = (dirName : string) => {
        this.selectedDirectory = dirName
        this.updateImageData()
    }

    @action selectSegmentationFile = (fName: string) => {
        this.selectedSegmentationFile = fName
        this.updateSegmentationData()
    }

    @action setCanvasImageData = (data:ImageData) => {
        this.canvasImageData = data
    }

    @action doSegmentation = () => {
        console.log("segmenting")
        if(this.canvasImageData != null) {
            let xhr = new XMLHttpRequest
            xhr.open("POST", "http://127.0.0.1:5000/segmentation", true)
            xhr.responseType = "arraybuffer"
            xhr.onload = action((e) => {
                if (xhr.readyState === 4) {
                    console.log(xhr)
                    let v = new Uint8ClampedArray(xhr.response)
                    let layer = new LabelLayer()
                    layer.data = v
                    layer.width = this.canvasImageData!.width
                    layer.height = this.canvasImageData!.height
                    layer.name = "test segmentation"
                    layer.visible = true
                    this.labelsLayers.push(layer)
                    //this.labelsLayers = [v]
                    console.log(v)
                }
            })

            xhr.setRequestHeader("width", this.canvasImageData.width.toString())
            xhr.setRequestHeader("height", this.canvasImageData.height.toString())
            xhr.send(this.canvasImageData.data.buffer)
        }
    }
}