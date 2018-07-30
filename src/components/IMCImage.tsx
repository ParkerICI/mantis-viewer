import * as React from "react"
import * as ReactDOM from "react-dom"
import * as d3Array from "d3-array"
import * as fs from "fs"
import * as PIXI from "pixi.js"
import { ImageStore } from "../stores/ImageStore"
import { observer } from "mobx-react"
import { IMCData } from "../lib/IMCData"
import { ChannelName } from "../interfaces/UIDefinitions"
import { quantile } from "../lib/utils"
import { SelectionLayer } from "./SelectionLayer"
import { BrushEventHandler } from "../interfaces/UIDefinitions"

export interface IMCImageProps {

    imageData: IMCData,
    channelDomain: Record<ChannelName, [number, number]>
    channelMarker: Record<ChannelName, string | null>
    canvasWidth: number
    canvasHeight: number 
    onCanvasDataLoaded: ((data: ImageData) => void)

}

@observer
export class IMCImage extends React.Component<IMCImageProps, undefined> {

    el:HTMLDivElement | null = null

    renderer: PIXI.WebGLRenderer
    rootContainer : PIXI.Container
    stage: PIXI.Container

    channelFilters: Record<ChannelName, PIXI.filters.ColorMatrixFilter>

    constructor(props:IMCImageProps) {
        super(props)
        this.rootContainer = new PIXI.Container()
        this.stage = new PIXI.Container()
        this.stage.interactive = true
        this.rootContainer.addChild(this.stage)

        let redFilter = new PIXI.filters.ColorMatrixFilter()
        redFilter.matrix = [
            1, 0, 0, 0, 0,
            0, 0, 0, 0, 0,
            0, 0, 0, 0, 0,
            0, 0, 0, 1, 0
        ]
        redFilter.blendMode = PIXI.BLEND_MODES.ADD

        let greenFilter = new PIXI.filters.ColorMatrixFilter()
        greenFilter.matrix = [
            0, 0, 0, 0, 0,
            0, 1, 0, 0, 0,
            0, 0, 0, 0, 0,
            0, 0, 0, 1, 0
        ]
        greenFilter.blendMode = PIXI.BLEND_MODES.ADD

        let blueFilter = new PIXI.filters.ColorMatrixFilter()
        blueFilter.matrix = [
            0, 0, 0, 0, 0,
            0, 0, 0, 0, 0,
            0, 0, 1, 0, 0,
            0, 0, 0, 1, 0
        ]
        blueFilter.blendMode = PIXI.BLEND_MODES.ADD

       this.channelFilters = {
            rChannel: redFilter,
            gChannel: greenFilter,
            bChannel: blueFilter
        }
    }

    onCanvasDataLoaded = (data: ImageData) => this.props.onCanvasDataLoaded(data)

    zoom = (x:number, y:number, isZoomIn:boolean) => {
        console.log("Zooming...")
        let beforeTransform = this.renderer.plugins.interaction.eventData.data.getLocalPosition(this.stage)
        
        let direction = isZoomIn ? 1 : -1
        let factor = (1 + direction * 0.05)
        //this.edgeContainer.visible = false
        this.stage.scale.x *= factor
        this.stage.scale.y *= factor

        //Cant zoom out out past 1
        if (this.stage.scale.x < 1.0 && this.stage.scale.y < 1.0) {
            this.stage.scale.x = 1.0
            this.stage.scale.y = 1.0
            // Hacky workaround so that image is centered when zoomed out.
            this.stage.position.x = 0
            this.stage.position.y = 0
        } else {
            this.stage.updateTransform()
            
            setTimeout(() => { this.stage.visible = true; this.renderer.render(this.rootContainer) }, 200)
            
            this.stage.updateTransform()
            let afterTransform = this.renderer.plugins.interaction.eventData.data.getLocalPosition(this.stage)

            this.stage.position.x += (afterTransform.x - beforeTransform.x) * this.stage.scale.x
            this.stage.position.y += (afterTransform.y - beforeTransform.y) * this.stage.scale.y
        }
        this.stage.updateTransform()
        this.renderer.render(this.rootContainer)
    }
    
    // Generating brightness filter code for the passed in channel.
    // Somewhat hacky workaround without uniforms because uniforms weren't working with Typescript.
    generateBrightnessFilterCode = ( 
        channelName:ChannelName,
        imcData:IMCData, 
        channelMarker: Record<ChannelName, string | null>,
        channelDomain:  Record<ChannelName, [number, number]>) => {

        let curChannelDomain = channelDomain[channelName]

        // Get the max value for the given channel.
        let marker = channelMarker[channelName]
        let channelMax = 100.0
        if (marker != null){
            channelMax = imcData.minmax[marker].max
        }

        // Get the PIXI channel name (i.e. r, g, b) from the first character of the channelName.
        let channel = channelName.charAt(0)

        // Using slider values to generate m and b for a linear transformation (y = mx + b).
        let b = ((curChannelDomain["0"] === 0 ) ? 0 : curChannelDomain["0"]/channelMax).toFixed(4)
        let m = ((curChannelDomain["1"] === 0) ? 0 : (channelMax/(curChannelDomain["1"] - curChannelDomain["0"]))).toFixed(4)

        let filterCode = `
        varying vec2 vTextureCoord;
        varying vec4 vColor;
        
        uniform sampler2D uSampler;
        uniform vec4 uTextureClamp;
        uniform vec4 uColor;
        
        void main(void)
        {
            gl_FragColor = texture2D(uSampler, vTextureCoord);
            gl_FragColor.${channel} = min((gl_FragColor.${channel} * ${m}) + ${b}, 1.0);
        }`

        return filterCode

    }

    renderImage(el: HTMLDivElement, 
        imcData: IMCData, 
        channelMarker: Record<ChannelName, string | null>,
        channelDomain: Record<ChannelName, [number, number]>) {

        if(el == null)
            return
        this.el = el

        if(!this.el.hasChildNodes()) {
            this.renderer = new PIXI.WebGLRenderer(imcData.width, imcData.height)
            this.stage.hitArea = new PIXI.Rectangle(0, 0, this.renderer.width, this.renderer.height)
            el.appendChild(this.renderer.view)
        }

        this.el.addEventListener("wheel", e => {
            e.stopPropagation()
            e.preventDefault()
            this.zoom(e.clientX, e.clientY, e.deltaY < 0)
        })

        this.stage.removeChildren()

        // For each channel setting the brightness and color filters
        for (let s of ["rChannel", "gChannel", "bChannel"]) {
            let curChannel = s as ChannelName
            let brightnessFilterCode = this.generateBrightnessFilterCode(curChannel, imcData, channelMarker, channelDomain)
            let curMarker = channelMarker[curChannel] 
            if(curMarker != null) {
                let brightnessFilter = new PIXI.Filter(undefined, brightnessFilterCode, undefined)
                let sprite = imcData.sprites[curMarker]
                sprite.filters = [brightnessFilter, this.channelFilters[curChannel]]
                this.stage.addChild(sprite)
            }
        }
   
        this.renderer.render(this.rootContainer)
        
    }

    render() {
        //Dereferencing these here is necessary for Mobx to trigger, because
        //render is the only tracked function (i.e. this will not trigger if
        //the variables are dereferenced inside renderImage)
        console.log("Rendering image")
        let channelMarker = {
            rChannel: this.props.channelMarker.rChannel,
            gChannel: this.props.channelMarker.gChannel,
            bChannel: this.props.channelMarker.bChannel
        }
        let channelDomain = {
            rChannel: this.props.channelDomain.rChannel,
            gChannel: this.props.channelDomain.gChannel,
            bChannel: this.props.channelDomain.bChannel
        }
        
        let imcData = this.props.imageData
        let scaleFactor = 1200 / imcData.width

        let width = imcData.width * scaleFactor
        let height = imcData.height * scaleFactor

        return(
            <div className="imcimage"
                    ref={(el) => {this.renderImage(el, imcData, channelMarker, channelDomain)}}
            />
        )
    }
}