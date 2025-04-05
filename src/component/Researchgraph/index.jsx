import React, { useState, useEffect } from 'react'
import ReactECharts from 'echarts-for-react';
import axios from 'axios';

export default function Researchgraph() {

    const bg_theme = 'bg_theme_dark'
    const [option, setEchartsOption] = useState({
        title: {
            text: 'Research Graph'
        },
        tooltip: {},

        series: [
            {
                name: 'graph1',
                type: 'graph',
                layout: 'force',
                roam: true,
                categories: [],
                data: [],
                links: [],
                lineStyle: {
                    opacity: 0.9,
                    width: 2,
                    curveness: 0
                }
            }
        ]
    })

    useEffect(() => {
        axios.get('/researchgraphdata/papertype.json').then(res => {
            const categories = res.data
            axios.get('/researchgraphdata/papers.json').then(res => {
                const nodes = res.data
                nodes.forEach(function (node) {
                    node.id = node.Title
                    node.name = node.Title
                    console.log(node)
                    node.symbolSize = 3*Math.max(node.Cite,5)**0.5;
                })
                axios.get('/researchgraphdata/paperlinks.json').then(res => {
                    const links = res.data
                    setEchartsOption(
                        {
                            legend: [
                                {
                                    data: categories
                                }
                            ],
                            series: [{
                                name: 'graph1',
                                roam: true,
                                categories: categories,
                                data: nodes,
                                links: links
                            }]
                        }
                    )
                })
            })
        })

    }, [])

    return (
        <ReactECharts
            option={option}
            notMerge={false}
            style={{ height: '550px', width: '100%' }}
            theme={bg_theme}
        />
    )
}