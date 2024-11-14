import React, { useEffect, useState } from 'react';
import { Typography, Divider, Skeleton } from 'antd';
import ReactMarkdown from 'react-markdown'
import { useTranslation } from 'react-i18next';
import DeckGL from '@deck.gl/react';
import { AmbientLight, LightingEffect, MapView, FirstPersonView, _SunLight as SunLight } from '@deck.gl/core';
import { _MapContext as MapContext, StaticMap, NavigationControl, ScaleControl, FlyToInterpolator } from 'react-map-gl';
import { GeoJsonLayer } from 'deck.gl';

const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoibmkxbzEiLCJhIjoiY2t3ZDgzMmR5NDF4czJ1cm84Z3NqOGt3OSJ9.yOYP6pxDzXzhbHfyk3uORg';

export default function Introduction() {
    const { t, i18n } = useTranslation();
    //地图光效
    const [lightx, setlightx] = useState(1554937300)
    const [lightintensity, setlightintensity] = useState(2)
    const ambientLight = new AmbientLight({
        color: [255, 255, 255],
        intensity: 1.0
    });


    const sunLight = new SunLight({
        timestamp: lightx,
        color: [255, 255, 255],
        intensity: lightintensity
    });
    const lightingEffect = new LightingEffect({ ambientLight, sunLight });

    const material = {
        ambient: 0.1,
        diffuse: 0.6,
        shininess: 22,
        specularColor: [60, 64, 70]
    };

    const theme = {
        buildingColor: [255, 255, 255],
        trailColor0: [253, 128, 93],
        trailColor1: [23, 184, 190],
        material,
        effects: [lightingEffect]
    };
    const layers = [
        new GeoJsonLayer({
            id: 'GeoJsonLayer',
            data: {
                "type": "FeatureCollection",
                "features": [
                  {
                    "type": "Feature",
                    "geometry": {
                      "type": "Point",
                      "coordinates": [113.9716795403871, 22.59656570376175]
                    },
                    "properties": {
                        "name": "PKUSZ Smart City Lab"
                    }
                  }
                ]
              },
            stroked: false,
            filled: true,
            pointType: 'circle+text',
            pickable: true,
            getText: (f) => f.properties.name,
            getTextPixelOffset: [130, 0],
            getTextBackgroundColor:[0,0,0,255],
            textFontFamily:'Optima, sans-serif',
            textBackground:true,
            textFontWeight: 'bold',
            getTextSize:20,
            textBackgroundPadding: [7, 5],
            getTextColor:[255,255,255],
            getFillColor: [255,0,0],
            getLineWidth: 20,
            getPointRadius: 4,
            pointRadiusMinPixels:8,
            pointRadiusMaxPixels:8,
        })
    ]

    return (

        <DeckGL
            layers={layers}
            effects={theme.effects}
            initialViewState={{
                longitude: 113.9716795403871, 
                latitude: 22.59656570376175,
                zoom: 16.5,
                pitch: 0,
                bearing: 0
            }}
            controller={true}
        >
            <MapView id="baseMap"
                controller={true}
                y="0%"
                height="100%"
                position={
                    [0, 0, 0]}>
                <StaticMap reuseMaps key='mapboxgl-ctrl-bottom-left'
                    mapboxApiAccessToken={MAPBOX_ACCESS_TOKEN}
                    mapStyle={`mapbox://styles/ni1o1/cl38pr5lx001f15nyyersk7in`}
                    preventStyleDiffing={true} >
                    <div className='mapboxgl-ctrl-bottom-left' style={{ bottom: '20px' }}>
                        <ScaleControl maxWidth={100} unit="metric" />
                    </div>
                </StaticMap>
                <div className='mapboxgl-ctrl-bottom-right' style={{ bottom: '80px' }}>
                </div>
            </MapView>
        </DeckGL>

    )
}
