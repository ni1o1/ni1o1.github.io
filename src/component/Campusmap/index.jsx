import React, { useEffect, useState } from 'react';
import { Typography, Divider, Skeleton } from 'antd';
import ReactMarkdown from 'react-markdown'
import { useTranslation } from 'react-i18next';
import DeckGL from '@deck.gl/react';
import { AmbientLight, LightingEffect, MapView, FirstPersonView, _SunLight as SunLight } from '@deck.gl/core';
import { _MapContext as MapContext, StaticMap, NavigationControl, ScaleControl, FlyToInterpolator } from 'react-map-gl';
import { GeoJsonLayer } from 'deck.gl';
import {PolygonLayer} from '@deck.gl/layers';
import axios from 'axios';
import { ScenegraphLayer } from 'deck.gl';

const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoibmkxbzEiLCJhIjoiY2t3ZDgzMmR5NDF4czJ1cm84Z3NqOGt3OSJ9.yOYP6pxDzXzhbHfyk3uORg';

export default function Introduction() {
    const { t, i18n } = useTranslation();
    //地图光效
    //获取当前时间戳

    //const timestamp = new Date().getTime() ;
    const timestamp = Date.now()
    const [lightx, setlightx] = useState(timestamp)

    const [bddata,setbddata] = useState({
        "type": "FeatureCollection",
        "features": []
    })

    useEffect(() => {
        //允许右键旋转视角
        document.getElementById("deckgl-wrapper").addEventListener("contextmenu", evt => evt.preventDefault());
        axios.get('/data/bd.geojson').then(res => {
            setbddata(res.data)
        })
      }, [])


    const dirLight = new SunLight({
        timestamp: lightx,
        color: [255, 255, 255],
        intensity: 8,
        _shadow: true
      });

      const [effects] = useState(() => {
        const lightingEffect = new LightingEffect({ dirLight });
        lightingEffect.shadowColor = [0, 0, 0, 0.5];
        return [lightingEffect];
      });



    const layers = [
     
        new PolygonLayer({
            id: 'ground',
            data: [[[113.96, 22.58],
            [113.96, 22.60],
            [113.98, 22.60],
            [113.98, 22.58],
        ]],
            stroked: false,
            getPolygon: f => f,
            getFillColor: [0, 0, 0,0]
          }),
          new ScenegraphLayer({
            id: 'ScenegraphLayer',
            data: [{ 'coord': [113.974171 - 0.00196, 22.594238 + 0.00234] }
            ],
            getColor: [49,144,252],
            getPosition: (d) => d.coord,
            getOrientation: (d) => [0, 180, 90],
            scenegraph: "data/bd.glb",
            sizeScale: 0.0013,
            _lighting: 'pbr',
            pickable: true
          }),   
        new GeoJsonLayer({
            id: 'geojson',
            data:bddata,
            opacity: 1,
            stroked: false,
            filled: true,
            extruded: true,
            wireframe: false,
            getElevation: f => f.properties.height,
            getFillColor: f=>{
                if(f.properties.building_id==2963){
                    return [49,144,252]
                }else{
                    return [255, 255, 255]
                }},
                wireframe: true,
            getLineColor: [0,0,0],
            pickable: true
          }),
        new GeoJsonLayer({
            id: 'GeoJsonLayer',
            data: {
                "type": "FeatureCollection",
                "features": [
                  {
                    "type": "Feature",
                    "geometry": {
                      "type": "Point",
                      "coordinates": [113.9721795403871, 22.59676570376175]
                    },
                    "properties": {
                        "name": "PKUSZ Smart City Lab"
                    }
                  }
                ]
              },
            stroked: false,
            extruded: false,
            material: {
                ambient: 1.0,       // 环境光强度100%
                diffuse: 0.0,       // 无漫反射
                shininess: 0.0,     // 无高光
                specularColor: [0,0,0] // 无镜面高光色
              },
            filled: true,
            pointType: 'circle+text',
            pickable: true,
            getText: (f) => f.properties.name,
            getTextPixelOffset: [130, -15],
            getTextBackgroundColor:[0,0,0,255],
            textFontFamily:'Optima, sans-serif',
            textBackground:true,
            textFontWeight: 'bold',
            getTextSize:20,
            textBackgroundPadding: [7, 5],
            getTextColor:[255,255,255],
            getFillColor: [255,0,0,0],
            getLineWidth: 20,
            getPointRadius: 0,
            pointRadiusMinPixels:0,
            pointRadiusMaxPixels:0,
        })
    ]

    return (

        <DeckGL
            layers={layers}
             effects={effects}
            initialViewState={{
                longitude: 113.9719795403871, 
                latitude: 22.59656570376175,
                zoom: 18.3,
                pitch: 60,
                bearing: -150
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
