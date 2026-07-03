/*
Copyright 2025 Tereza Cahová

Licensed under the Apache License, Version 2.0 (the "License"); 
you may not use this file except in compliance with the License. 
You may obtain a copy of the License at 
http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software 
distributed under the License is distributed on an "AS IS" BASIS, 
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
See the License for the specific language governing permissions and 
limitations under the License.
*/

function drawMainMap() {
    const container = d3.select("#main-map-container");
    const width = container.node().clientWidth;
    const height = container.node().clientHeight;

    const svg = d3.select("#main-map")
        .attr("width", width)
        .attr("height", height);

    svg.selectAll("*").remove();

    drawChoropleth(svg, width * 0.96, height * 0.96, currentCategory, true);

    const label = d3.select("#main-map-label");
    label.text(currentCategory.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()));

    const words = currentCategory.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()).split(" ");
    const dateFormat = d3.timeFormat("%b %d, %H:%M"); 
    const timeLabel = `${dateFormat(timeRangeStart)} – ${dateFormat(timeRangeEnd)}`;

    label.html(`
            <div>${words[0]} <br> ${words.slice(1).join(" ")}</div>
            <div class="time-label">${timeLabel}</div>
        `)
        .style("color", categoryColors[currentCategory]);
}

function drawMiniMaps() {
    const miniCategories = reportCategories.filter(cat => cat != currentCategory);

    const container = d3.select("#mini-maps-container");
    container.selectAll("*").remove(); 

    miniCategories.forEach(cat => {
        const currentMap = container.append("div")
            .attr("class", "mini-map-container");

        currentMap.append("div")
            .attr("class", "mini-map-label")
            .style("color", "#555") 
            .text(cat.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()));

        const svg = currentMap.append("svg")
            .attr("class", "mini-map")
            .style("height", "90%")
            .style("width", "60%");

        drawChoropleth(svg, svg.node().clientWidth, svg.node().clientHeight, cat, false);

        currentMap.on("click", () => {
            currentCategory = cat;
            activeCategories = new Set([currentCategory]);

            drawMainMap();
            drawMiniMaps();
            showDetail();
        });
    });
}

function drawChoropleth(svg, width, height, reportCategory, mainMap) {
    d3.json("./data/StHimark.geojson").then(geoData => {
        const projection = d3.geoMercator().fitSize([width, height], geoData);
        const pathGenerator = d3.geoPath().projection(projection);

        const thresholds = d3.range(1, 10); 
        const colorBins = 10;

        const colorScale = d3.scaleThreshold()
            .domain(thresholds) 
            .range(d3.range(colorBins).map(i => d3.interpolateYlOrRd(i / (colorBins - 1))));
            
        const paths = svg.selectAll("path")
            .data(geoData.features)
            .enter()
            .append("path")
            .attr("d", pathGenerator)
            .attr("stroke", "#555")
            .attr("fill", d => {
                const neighborhood = groupedData.get(d.properties.Id);
                if (!neighborhood || neighborhood.avgValues[reportCategory] == null) {
                    return "#ccc"; 
                }
                return colorScale(neighborhood.avgValues[reportCategory]);
            })
            .on("click", (event, d) => {
                if (!mainMap) { return; }
                
                regionId = d.properties.Id;

                svg.selectAll("path")
                    .classed("highlighted-region", false);

                d3.select(event.currentTarget)
                    .classed("highlighted-region", true);

                d3.select("#detail-legend-container")
                    .text(`(${regionId}) ${regionNames[regionId]}`)
                    .style("color", "#555");
                
                showDetail();
            });
        
        if (mainMap) {
            // Highlight the selected region
            paths.classed("highlighted-region", d => d.properties.Id == regionId);
            d3.select("#detail-legend-container")
                .text(`(${regionId}) ${regionNames[regionId]}`)
                .style("color", "#555");

            // Overlay region-IDs
            svg.selectAll("text.region-label")
                .data(geoData.features)
                .enter()
                .append("text")
                .attr("x", d => projection(d3.geoCentroid(d))[0])
                .attr("y", d => projection(d3.geoCentroid(d))[1])
                .text(d => d.properties.Id)
                .attr("text-anchor", "middle")
                .attr("font-size", "0.8vw")
                .attr("fill", "black")
                .attr("opacity", 0.9);

            // Show tooltip
            const tooltip = d3.select("#tooltip");
            paths
                .on("mouseover", (event, d) => {
                    const neighborhood = groupedData.get(d.properties.Id);
                    tooltip.transition().style("opacity", 0.9)

                    if (neighborhood.reportCount == 0) {
                        tooltip.html(`
                            <strong>${regionNames[d.properties.Id]}</strong><br>
                            No data available for this time range. <br>
                            Total Reports: ${neighborhood.reportCount}
                        `);
                    } else if (neighborhood.nonNull[reportCategory] == 0){
                        tooltip.html(`
                            <strong>${regionNames[d.properties.Id]}</strong> <br>
                            Reports (${reportCategory.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}): ${neighborhood.nonNull[reportCategory]} <br>
                            Total Reports: ${neighborhood.reportCount}
                        `);
                    } else {
                        tooltip.html(`
                            <strong>${regionNames[d.properties.Id]}</strong> <br>
                            Mean: ${neighborhood.avgValues[reportCategory].toFixed(2)} <br>
                            Median: ${neighborhood.medianValues[reportCategory]} <br>
                            Max: ${neighborhood.maxValues[reportCategory]} <br>
                            Reports (${reportCategory.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}): ${neighborhood.nonNull[reportCategory]} <br>
                            Total Reports: ${neighborhood.reportCount}
                        `);
                    }
                })
                .on("mousemove", (event) => {
                    tooltip
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 30) + "px");
                })
                .on("mouseout", () => {
                    tooltip.transition().style("opacity", 0);
                });
        }

        if (overlayMajorQuake && mainMap) {
            svg.append("image")
                .attr("xlink:href", "./data/majorquakeShakemap.png")
                .attr("x", -60)
                .attr("y", -40)
                .attr("width", width + 60)
                .attr("height", height + 70)
                .attr("opacity", 0.9);  
        }

        if (overlayPreQuake && mainMap) {
            svg.append("image")
                .attr("xlink:href", "./data/prequakeShakemap.png")
                .attr("x", -60)
                .attr("y", -40)
                .attr("width", width + 60)
                .attr("height", height + 70)
                .attr("opacity", 0.9);  
        }

        if (overlayFacilities && mainMap) {
            svg.append("image")
                .attr("xlink:href", "./data/facilities.png")
                .attr("x", -20)
                .attr("y", -20)
                .attr("width", width + 60)
                .attr("height", height + 60)
                .attr("opacity", 0.9);  
        }

        // Small box plots
        if (mainMap && showMiniBoxplots) {
            drawBoxPlots(geoData, projection, svg, reportCategory);
        }

        // Bubbles (report count)
        if (mainMap && showBubbles) {
            drawBubbles(geoData, projection, svg, reportCategory);
        }

        // Small bar charts
        if (mainMap && showMiniBarcharts) {
            drawBars(geoData, projection, svg, reportCategory);
        }
    });
}

function drawColorLegend() {
    const container = d3.select("#legend-container");
    container.selectAll("*").remove();

    const margin = { top: 40, right: 10, bottom: 30, left: 10 };
    const legendWidth = container.node().clientWidth - margin.left - margin.right;
    const legendHeight = 60;

    const svg = container.append("svg")
        .attr("width", legendWidth + margin.left + margin.right)
        .attr("height", legendHeight + margin.top + margin.bottom);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Color scale
    const legendThresholds = d3.range(0, 11);
    const colorBins = 10;

    const colorScale = d3.scaleThreshold()
        .domain(d3.range(1, 10)) 
        .range(d3.range(colorBins).map(i => d3.interpolateYlOrRd(i / (colorBins - 1))));

    const x = d3.scaleLinear()
        .domain([0, 10])
        .range([0, legendWidth]);

    // Colored rectangles
    g.selectAll("rect")
        .data(d3.pairs(legendThresholds))
        .enter()
        .append("rect")
        .attr("x", d => x(d[0]))
        .attr("y", 0)
        .attr("width", d => x(d[1]) - x(d[0]))
        .attr("height", legendHeight - margin.bottom)
        .attr("fill", d => colorScale((d[0] + d[1]) / 2));

    // Axis
    const xAxis = d3.axisBottom(x)
        .tickValues(legendThresholds);

    g.append("g")
        .attr("transform", `translate(0, ${legendHeight - margin.bottom})`)
        .call(xAxis);
    
    // Label
    svg.append("text")
        .attr("x", (margin.left ))
        .attr("y", margin.top - 10)
        .attr("text-anchor", "left")
        .style("fill", "#555")
        .text("Mean Severity Value:");
}

function drawLegend() {
    const container = d3.select("#buttons-container");
    container.selectAll("*").remove();

    container.append("button")
        .text(() => overlayMajorQuake ? "Hide Shake Map: Apr 8" : "Show Shake Map: Apr 8")
        .attr("class", "legend-button")
        .on("click", () => {
            tmp = overlayMajorQuake;
            hideOverlays();
            overlayMajorQuake = !tmp;
            drawMainMap();
            drawLegend(); 
        });
    
    container.append("button")
        .text(() => overlayPreQuake ? "Hide Shake Map: Apr 6" : "Show Shake Map: Apr 6")
        .attr("class", "legend-button")
        .on("click", () => {
            tmp = overlayPreQuake;
            hideOverlays();
            overlayPreQuake = !tmp;
            drawMainMap();
            drawLegend(); 
        });

    container.append("button")
        .text(() => overlayFacilities ? "Hide Facilities" : "Show Facilities")
        .attr("class", "legend-button")
        .on("click", () => {
            tmp = overlayFacilities;
            hideOverlays();
            overlayFacilities = !tmp;
            drawMainMap();
            drawLegend(); 
        });

    container.append("button")
        .text(() => showMiniBarcharts ? "Hide Bar Charts" : "Show Bar Charts")
        .attr("class", "legend-button")
        .attr("title", "Bar charts show distribution of reported severity (0-10) in each region.")
        .style("margin-top", "40px")
        .on("click", () => {
            tmp = showMiniBarcharts;
            hideOverlays();
            showMiniBarcharts = !tmp;
            drawMainMap();
            drawLegend(); 
        });

    container.append("button")
        .text(() => showMiniBoxplots ? "Hide Boxplots" : "Show Boxplots")
        .attr("class", "legend-button")
        .attr("title", "Box plots show the spread of reported severity in each region.")
        .on("click", () => {
            tmp = showMiniBoxplots;
            hideOverlays();
            showMiniBoxplots = !tmp;
            drawMainMap();
            drawLegend(); 
        });
    
    container.append("button")
        .text(() => showBubbles ? "Hide Number of Reports" : "Show Number of Reports")
        .attr("class", "legend-button")
        .attr("title", "The size of a bubble represents the number of reports in each region.")
        .on("click", () => {
            tmp = showBubbles;
            hideOverlays();
            showBubbles = !tmp;
            drawMainMap();
            drawLegend(); 
        });

    drawColorLegend();
}

function hideOverlays() {
    overlayMajorQuake = false;
    overlayPreQuake = false;
    overlayFacilities = false;
    showMiniBarcharts = false;
    showMiniBoxplots = false;
    showBubbles = false;
}