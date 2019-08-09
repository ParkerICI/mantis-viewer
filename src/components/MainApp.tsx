import * as React from 'react'
import { Grid, Row, Col } from 'react-flexbox-grid'
import { SizeMe } from 'react-sizeme'
import { Button, Collapse, Modal, ModalHeader, ModalBody, Spinner } from 'reactstrap'

import { ProjectStore } from '../stores/ProjectStore'
import { ChannelControls } from './ChannelControls'
import { observer } from 'mobx-react'
import { ChannelName, WindowHeightBufferSize, ChannelSegmentationCombinedHeight } from '../definitions/UIDefinitions'
import { ImageViewer } from './ImageViewer'
import { ImageSetSelector } from './ImageSetSelector'
import { SegmentationControls } from './SegmentationControls'
import { Plot } from './Plot'
import { SelectedPopulations } from './SelectedPopulations'
import { ImageData } from '../lib/ImageData'
import { SegmentationData } from '../lib/SegmentationData'
import { SelectedPopulation } from '../interfaces/ImageInterfaces'
import { ImageChannels, GraphSelectionPrefix, ImageSelectionPrefix } from '../definitions/UIDefinitions'

export interface MainAppProps {
    projectStore: ProjectStore
}

interface MainAppState {
    channelsOpen: boolean
    regionsOpen: boolean
    segmentationOpen: boolean
    plotOpen: boolean
}

@observer
export class MainApp extends React.Component<MainAppProps, MainAppState> {
    public constructor(props: MainAppProps) {
        super(props)
    }

    public state = {
        channelsOpen: true,
        regionsOpen: true,
        segmentationOpen: false,
        plotOpen: false,
    }

    // Reverse ImageChannels so that select order is RGBCMYK
    private imageChannelsForControls = ImageChannels.slice().reverse()

    private notEnoughSpaceForChannelAndSegmentation = () => {
        let windowHeight = this.props.projectStore.windowHeight
        if (windowHeight && windowHeight < ChannelSegmentationCombinedHeight) return true
        return false
    }

    // If opening channels, close segmentation controls
    private handleChannelClick = () => {
        let newChannelsOpenValue = !this.state.channelsOpen
        this.setState({ channelsOpen: newChannelsOpenValue })
        if (newChannelsOpenValue && this.notEnoughSpaceForChannelAndSegmentation())
            this.setState({ segmentationOpen: false })
    }
    // If opening segmentation controls, close channels
    private handleSegmentationClick = () => {
        let newSegmentationOpenValue = !this.state.segmentationOpen
        this.setState({ segmentationOpen: newSegmentationOpenValue })
        if (newSegmentationOpenValue && this.notEnoughSpaceForChannelAndSegmentation())
            this.setState({ channelsOpen: false })
    }
    private handleRegionsClick = () => this.setState({ regionsOpen: !this.state.regionsOpen })
    private handlePlotClick = () => this.setState({ plotOpen: !this.state.plotOpen })

    private addSelectionFromGraph = (segmentIds: number[]) => {
        let populationStore = this.props.projectStore.activePopulationStore
        if (segmentIds.length > 0) populationStore.addSelectedPopulation(null, segmentIds, GraphSelectionPrefix)
    }

    private addSelectionFromImage = (selectedRegion: number[], segmentIds: number[], color: number) => {
        let populationStore = this.props.projectStore.activePopulationStore
        populationStore.addSelectedPopulation(selectedRegion, segmentIds, ImageSelectionPrefix, null, color)
    }

    private updateSelectionsFromImage = (selected: SelectedPopulation[]) => {
        let populationStore = this.props.projectStore.activePopulationStore
        populationStore.setSelectedPopulations(selected)
    }

    private getChannelMin(s: ChannelName): number {
        let imageStore = this.props.projectStore.activeImageStore
        let channelMarker = imageStore.channelMarker[s]
        if (channelMarker != null && imageStore.imageData != null) {
            return imageStore.imageData.minmax[channelMarker].min
        }
        return 0
    }

    private getChannelMax(s: ChannelName): number {
        let imageStore = this.props.projectStore.activeImageStore
        let channelMarker = imageStore.channelMarker[s]
        if (channelMarker != null && imageStore.imageData != null) {
            return imageStore.imageData.minmax[channelMarker].max
        }
        return 100
    }

    private loadingModal(imageDataLoading: boolean, segmentationDataLoading: boolean): JSX.Element | null {
        let modal = null
        if (imageDataLoading || segmentationDataLoading) {
            let modalType = imageDataLoading ? 'Image Data' : 'Segmentation Data'
            modal = (
                <Modal isOpen={true}>
                    <ModalHeader>{modalType} is loading...</ModalHeader>
                    <ModalBody>
                        <div style={{ textAlign: 'center' }}>
                            <Spinner style={{ width: '5rem', height: '5rem' }} />
                        </div>
                    </ModalBody>
                </Modal>
            )
        }
        return modal
    }

    private renderImageViewer(
        imageData: ImageData | null,
        segmentationData: SegmentationData | null,
        segmentationFillAlpha: number,
        segmentationOutlineAlpha: number,
        segmentationCentroidsVisible: boolean,
        channelDomain: Record<ChannelName, [number, number]>,
        channelVisibility: Record<ChannelName, boolean>,
        channelMarker: Record<ChannelName, string | null>,
        maxWidth: number,
        windowHeight: number | null,
        addSelectedPopulation: (selectedRegion: number[], selectedSegments: number[], color: number) => void,
        updateSelectedPopulations: (selectedRegions: SelectedPopulation[]) => void,
        selectedRegions: SelectedPopulation[] | null,
        hightlightedRegions: string[],
        highlightedSegments: number[],
        exportPath: string | null,
        onExportComplete: () => void,
    ): JSX.Element | null {
        let viewer = null
        if (imageData != null && windowHeight != null) {
            let maxRendererSize = { width: maxWidth, height: windowHeight - WindowHeightBufferSize }
            viewer = (
                <ImageViewer
                    imageData={imageData}
                    segmentationData={segmentationData}
                    segmentationFillAlpha={segmentationFillAlpha}
                    segmentationOutlineAlpha={segmentationOutlineAlpha}
                    segmentationCentroidsVisible={segmentationCentroidsVisible}
                    channelDomain={channelDomain}
                    channelVisibility={channelVisibility}
                    channelMarker={channelMarker}
                    maxRendererSize={maxRendererSize}
                    addSelectedRegion={addSelectedPopulation}
                    updateSelectedRegions={updateSelectedPopulations}
                    selectedRegions={selectedRegions}
                    hightlightedRegions={hightlightedRegions}
                    highlightedSegmentsFromPlot={highlightedSegments}
                    exportPath={exportPath}
                    onExportComplete={onExportComplete}
                />
            )
        }

        return viewer
    }

    public static getDerivedStateFromProps(props: MainAppProps, state: MainAppState): Partial<MainAppState> | null {
        let windowHeight = props.projectStore.windowHeight
        console.log(windowHeight)
        // If window height is defined, and we are now too short for both segmentation and channels to be open, close segmentation.
        if (
            windowHeight &&
            windowHeight < ChannelSegmentationCombinedHeight &&
            state.channelsOpen &&
            state.segmentationOpen
        )
            return {
                segmentationOpen: false,
            }
        return null
    }

    public render(): React.ReactNode {
        let projectStore = this.props.projectStore
        let imageStore = projectStore.activeImageStore
        let populationStore = projectStore.activePopulationStore
        let plotStore = projectStore.activePlotStore

        let imageSetSelector = null
        let channelControls = null
        let scatterPlot = null
        let segmentationControls = null

        imageSetSelector = (
            <ImageSetSelector
                selectedImageSet={projectStore.activeImageSetPath}
                imageSetOptions={projectStore.imageSetPathOptions.get()}
                setSelectedImageSet={projectStore.setActiveImageSetCallback()}
            />
        )

        if (imageStore.imageData != null) {
            if (imageStore.imageData.markerNames.length > 0) {
                channelControls = this.imageChannelsForControls.map((s: ChannelName) => (
                    <ChannelControls
                        key={s}
                        channel={s}
                        channelVisible={imageStore.channelVisibility[s]}
                        onVisibilityChange={projectStore.setChannelVisibilityCallback(s)}
                        sliderMin={this.getChannelMin(s)}
                        sliderMax={this.getChannelMax(s)}
                        sliderValue={imageStore.channelDomain[s]}
                        onDomainChange={projectStore.setChannelDomainCallback(s)}
                        selectOptions={imageStore.markerSelectOptions}
                        selectValue={imageStore.channelMarker[s]}
                        allSelectedValues={Object.values(imageStore.channelMarker)}
                        onMarkerChange={projectStore.setChannelMarkerCallback(s)}
                        windowWidth={projectStore.windowWidth}
                    />
                ))
            }

            if (imageStore.segmentationData != null) {
                segmentationControls = (
                    <SegmentationControls
                        fillAlpha={imageStore.segmentationFillAlpha}
                        outlineAlpha={imageStore.segmentationOutlineAlpha}
                        onFillAlphaChange={projectStore.setSegmentationFillAlpha}
                        onOutlineAlphaChange={projectStore.setSegmentationOutlineAlpha}
                        centroidsVisible={imageStore.segmentationCentroidsVisible}
                        setCentroidsVisible={projectStore.setSegmentationCentroidsVisible}
                        onClearSegmentation={projectStore.clearActiveSegmentationData}
                    />
                )

                if (projectStore.plotInMainWindow) {
                    scatterPlot = (
                        <Plot
                            windowWidth={projectStore.windowWidth}
                            markerSelectOptions={imageStore.markerSelectOptions}
                            selectedPlotMarkers={plotStore.selectedPlotMarkers}
                            setSelectedPlotMarkers={projectStore.setSelectedPlotMarkers}
                            selectedStatistic={plotStore.plotStatistic}
                            setSelectedStatistic={projectStore.setPlotStatistic}
                            selectedTransform={plotStore.plotTransform}
                            setSelectedTransform={projectStore.setPlotTransform}
                            selectedType={plotStore.plotType}
                            setSelectedType={projectStore.setPlotType}
                            selectedNormalization={plotStore.plotNormalization}
                            setSelectedNormalization={projectStore.setPlotNormalization}
                            setSelectedSegments={this.addSelectionFromGraph}
                            setSelectedRange={projectStore.addPopulationFromRange}
                            setHoveredSegments={plotStore.setSegmentsHoveredOnPlot}
                            plotData={plotStore.plotData}
                        />
                    )
                }
            }
        }

        let selectedPopulations = (
            <SelectedPopulations
                populations={populationStore.selectedPopulations}
                updateName={populationStore.updateSelectedPopulationName}
                updateColor={populationStore.updateSelectedPopulationColor}
                updateVisibility={populationStore.updateSelectedPopulationVisibility}
                deletePopulation={populationStore.deleteSelectedPopulation}
                setAllVisibility={populationStore.setAllSelectedPopulationVisibility}
                highlightPopulation={populationStore.highlightSelectedPopulation}
                unhighlightPopulation={populationStore.unhighlightSelectedPopulation}
            />
        )

        let fullWidth = { width: '100%' }
        let fullWidthBottomSpaced = { marginBottom: '0.5rem', width: '100%' }
        let paddingStyle = { paddingTop: '10px' }

        // Dereferencing these here for rendering the image viewer
        // With the way SizeMe works, any variables dereferenced within it
        // don't work as dereferences to trigger a React rerender
        let imageData = imageStore.imageData
        let segmentationData = imageStore.segmentationData
        let segmentationFillAlpha = imageStore.segmentationFillAlpha
        let segmentationOutlineAlpha = imageStore.segmentationOutlineAlpha
        let segmentationCentroidsVisible = imageStore.segmentationCentroidsVisible
        let channelDomain = imageStore.channelDomain
        let channelVisibility = imageStore.channelVisibility
        let channelMarker = imageStore.channelMarker
        let windowHeight = projectStore.windowHeight
        let selectedRegions = populationStore.selectedPopulations
        let hightlightedRegions = populationStore.highlightedPopulations
        let highlightedSegmentsFromPlot = plotStore.segmentsHoveredOnPlot
        let exportPath = imageStore.imageExportFilename
        let onExportComplete = imageStore.clearImageExportFilename

        let imageDataLoading = imageStore.imageDataLoading
        let segmentationDataLoading = imageStore.segmentationDataLoading

        return (
            <div>
                {this.loadingModal(imageDataLoading, segmentationDataLoading)}
                <Grid fluid={true} style={paddingStyle}>
                    <Row between="xs">
                        <Col xs={2} sm={2} md={2} lg={2}>
                            <div style={fullWidthBottomSpaced}>{imageSetSelector}</div>
                            <Button onClick={this.handleChannelClick} style={fullWidthBottomSpaced} size="sm">
                                {this.state.channelsOpen ? 'Hide' : 'Show'} Channel Controls
                            </Button>
                            <Collapse isOpen={this.state.channelsOpen} style={fullWidth}>
                                <div>{channelControls}</div>
                            </Collapse>
                            <Button
                                onClick={this.handleSegmentationClick}
                                style={fullWidthBottomSpaced}
                                size="sm"
                                disabled={imageStore.segmentationData == null}
                            >
                                {this.state.segmentationOpen ? 'Hide' : 'Show'} Segmentation Controls
                            </Button>
                            <Collapse isOpen={this.state.segmentationOpen} style={fullWidth}>
                                <div>{segmentationControls}</div>
                            </Collapse>
                        </Col>
                        <SizeMe>
                            {({ size }) => (
                                <Col xs={6} sm={6} md={6} lg={6}>
                                    <Grid fluid={true}>
                                        <Row center="xs">
                                            <Col>
                                                {this.renderImageViewer(
                                                    imageData,
                                                    segmentationData,
                                                    segmentationFillAlpha,
                                                    segmentationOutlineAlpha,
                                                    segmentationCentroidsVisible,
                                                    channelDomain,
                                                    channelVisibility,
                                                    channelMarker,
                                                    size.width,
                                                    windowHeight,
                                                    this.addSelectionFromImage,
                                                    this.updateSelectionsFromImage,
                                                    selectedRegions,
                                                    hightlightedRegions,
                                                    highlightedSegmentsFromPlot,
                                                    exportPath,
                                                    onExportComplete,
                                                )}
                                            </Col>
                                        </Row>
                                    </Grid>
                                </Col>
                            )}
                        </SizeMe>
                        <Col xs={4} sm={4} md={4} lg={4}>
                            <Button onClick={this.handleRegionsClick} style={fullWidthBottomSpaced} size="sm">
                                {this.state.regionsOpen ? 'Hide' : 'Show'} Selected Regions
                            </Button>
                            <Collapse isOpen={this.state.regionsOpen} style={fullWidth}>
                                {selectedPopulations}
                            </Collapse>
                            <Button
                                onClick={this.handlePlotClick}
                                style={fullWidthBottomSpaced}
                                size="sm"
                                disabled={imageStore.segmentationData == null}
                            >
                                {this.state.plotOpen ? 'Hide' : 'Show'} Plot Pane
                            </Button>
                            <Collapse isOpen={this.state.plotOpen} style={fullWidth}>
                                <div>{scatterPlot}</div>
                            </Collapse>
                        </Col>
                    </Row>
                </Grid>
            </div>
        )
    }
}
