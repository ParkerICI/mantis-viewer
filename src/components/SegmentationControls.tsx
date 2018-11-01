import * as React from "react"
import { Button, Slider, Checkbox } from "@blueprintjs/core"
import { observer } from "mobx-react"

export interface SegmentationControlsProps {
    fillAlpha: number
    outlineAlpha: number

    onFillAlphaChange: ((value: number) => void)
    onOutlineAlphaChange: ((value: number) => void)

    centroidsVisible: boolean
    setCentroidsVisible: ((visible: boolean) => void)

    onClearSegmentation: (() => void)
}

@observer
export class SegmentationControls extends React.Component<SegmentationControlsProps, {}> {

    constructor(props: SegmentationControlsProps) {
        super(props)
    }

    sliderMax = 10

    onFillAlphaSliderChange = (value: number) => this.props.onFillAlphaChange(value/this.sliderMax)
    onOutlineAlphaSliderChange = (value:number) => this.props.onOutlineAlphaChange(value/this.sliderMax)
    onCentroidVisibilityChange = (event: React.FormEvent<HTMLInputElement>) => this.props.setCentroidsVisible(event.currentTarget.checked)

    render() {
        return(
            <div>
                <Checkbox checked={this.props.centroidsVisible} label="Show Centroids" onChange={this.onCentroidVisibilityChange} />
                Segmentation Outline Alpha
                <Slider
                    value = {this.props.outlineAlpha * this.sliderMax}
                    onChange = {this.onOutlineAlphaSliderChange}
                    max = {this.sliderMax}
                />
                Segmentation Fill Alpha
                <Slider
                    value = {this.props.fillAlpha * this.sliderMax}
                    onChange = {this.onFillAlphaSliderChange}
                    max = {this.sliderMax}
                />
                <Button
                    text = {"Clear Segmentation"}
                    onClick = {this.props.onClearSegmentation}
                />
            </div>
        )
    }
}