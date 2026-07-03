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

const regionNames = {
  "1":  "PALACE HILLS",
  "2":  "NORTHWEST",
  "3":  "OLD TOWN",
  "4":  "SAFE TOWN",
  "5":  "SOUTHWEST",
  "6":  "DOWNTOWN",
  "7":  "WILSON FOREST",
  "8":  "SCENIC VISTA",
  "9":  "BROADVIEW",
  "10": "CHAPPARAL",
  "11": "TERRAPIN SPRINGS",
  "12": "PEPPER MILL",
  "13": "CHEDDARFORD",
  "14": "EASTON",
  "15": "WESTON",
  "16": "SOUTHTON",
  "17": "OAK WILLOW",
  "18": "EAST PARTON",
  "19": "WEST PARTON"
};

const categoryColors = {
  sewer_and_water:   "#2a9d8f",
  power:             "#3f729b",
  roads_and_bridges: "#7da88e",
  medical:           "#8779a9",
  buildings:         "#5a8d7a",
  shake_intensity:   "#7f8ab3" 
};

const reportCategories = ["sewer_and_water", "power", "roads_and_bridges", "medical", "buildings", "shake_intensity"];

let currentCategory = "shake_intensity";
let regionId = "1";
let activeKeys = null;
let activeCategories = new Set([currentCategory]) 

let data = null;
let groupedData = null;
let timeFilteredData = null;

let timeRangeStart = null;
let timeRangeEnd = null;

let overlayMajorQuake = false; 
let overlayPreQuake = false;
let overlayFacilities = false;
let showBubbles = false;
let showMiniBarcharts = false;
let showMiniBoxplots = false;


// Load csv data
d3.csv("./data/mc1.csv", (d) => {
    return {
        time: new Date(d["time"]),
        sewer_and_water: d["sewer_and_water"] === "" ? null : +d["sewer_and_water"],
        power: d["power"] === "" ? null : +d["power"],
        roads_and_bridges: d["roads_and_bridges"] === "" ? null : +d["roads_and_bridges"],
        medical: d["medical"] === "" ? null : +d["medical"],
        buildings: d["buildings"] === "" ? null : +d["buildings"],
        shake_intensity: d["shake_intensity"] === "" ? null : +d["shake_intensity"],
        location: +d["location"]
    };
}).then((csvData)=> {
    data = csvData;

    timeRangeStart = d3.min(data, d => d.time);
    timeRangeEnd = d3.max(data, d => d.time);

    filterAndGroupData();

    drawMainMap();
    drawMiniMaps();
    drawTimeline();
    drawLegend();
    showDetail();
});

function drawTimeline() {
    const container = d3.select("#timeline-container");
    container.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 80 };
    const width = container.node().clientWidth - margin.left - margin.right;
    const height = container.node().clientHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const hourlyReportCount = d3.rollup(
        timeFilteredData,
        v => v.length,
        d => d3.timeHour(d.time)
    );

    const hRCArray = Array.from(hourlyReportCount, ([date, count]) => ({date, count}));
    hRCArray.sort((a, b) => a.date - b.date);

    const xScale = d3.scaleTime()
        .domain(d3.extent(hRCArray, d => d.date))
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(hRCArray, d => d.count)]).nice()
        .range([height, 0]);

    const line = d3.line()
        .x(d => xScale(d.date))
        .y(d => yScale(d.count));

    svg.append("path")
        .data([hRCArray])
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", "#007acc")
        .attr("stroke-width", 2);

    // Axes
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).ticks(15));

    const yDomain = yScale.domain();
    const yTicks = [yDomain[0], (yDomain[0] + yDomain[1]) / 2, yDomain[1]];
    svg.append("g")
        .call(d3.axisLeft(yScale).tickValues(yTicks));
    
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 5)
        .attr("text-anchor", "middle")
        .text("Time")
        .style("font-size", "14px");

    svg.append("text")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 20)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .text("Total Reports")
        .style("font-size", "14px");

    // Brush
    const brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on("end", updateData);

    svg.append("g")
        .call(brush);

    // Dots 
    const tooltip = d3.select("#tooltip");
    
    svg.append("g")
        .selectAll("circle")
        .data(hRCArray)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.date))
        .attr("cy", d => yScale(d.count))
        .attr("r", 4)
        .attr("fill", "#007acc")
        .on("mouseover", (event, d) => {
            tooltip.transition().style("opacity", 0.9);
            tooltip.html(`
                <strong>${d3.timeFormat("%b %d, %H:%M")(d.date)}</strong> <br>
                Reports: ${d.count}
            `);
        })
        .on("mousemove", event => {
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 30) + "px");
        })
        .on("mouseout", () => {
            tooltip.transition().style("opacity", 0);
        });

    function updateData(event) {
        const extent = event.selection;

        timeRangeStart = xScale.invert(extent[0]);
        timeRangeEnd =  xScale.invert(extent[1]);

        filterAndGroupData();

        drawMainMap();
        drawMiniMaps();
        showDetail();
    }
}

function filterAndGroupData() {
    timeFilteredData = data.filter(d => d.time >= timeRangeStart && d.time <= timeRangeEnd);
    groupedData = d3.rollup(
        timeFilteredData,
        (reportedValues) => ({
            avgValues: {
                sewer_and_water: d3.mean(reportedValues, d => d.sewer_and_water),
                power: d3.mean(reportedValues, d => d.power),
                roads_and_bridges: d3.mean(reportedValues, d => d.roads_and_bridges),
                medical: d3.mean(reportedValues, d => d.medical),
                buildings: d3.mean(reportedValues, d => d.buildings),
                shake_intensity: d3.mean(reportedValues, d => d.shake_intensity)
            },
            medianValues: {
                sewer_and_water: d3.median(reportedValues, d => d.sewer_and_water),
                power: d3.median(reportedValues, d => d.power),
                roads_and_bridges: d3.median(reportedValues, d => d.roads_and_bridges),
                medical: d3.median(reportedValues, d => d.medical),
                buildings: d3.median(reportedValues, d => d.buildings),
                shake_intensity: d3.median(reportedValues, d => d.shake_intensity)
            },
            maxValues: {
                sewer_and_water: d3.max(reportedValues, d => d.sewer_and_water),
                power: d3.max(reportedValues, d => d.power),
                roads_and_bridges: d3.max(reportedValues, d => d.roads_and_bridges),
                medical: d3.max(reportedValues, d => d.medical),
                buildings: d3.max(reportedValues, d => d.buildings),
                shake_intensity: d3.max(reportedValues, d => d.shake_intensity)
            },
            reportCount: reportedValues.length,
            nonNull: {
                sewer_and_water: reportedValues.filter(d => d.sewer_and_water != null).length,
                power: reportedValues.filter(d => d.power != null).length,
                roads_and_bridges: reportedValues.filter(d => d.roads_and_bridges != null).length,
                medical: reportedValues.filter(d => d.medical != null).length,
                buildings: reportedValues.filter(d => d.buildings != null).length,
                shake_intensity: reportedValues.filter(d => d.shake_intensity != null).length
            }
        }),
        d => d.location
    );

    const allRegionIds = Object.keys(regionNames);
    for (const id of allRegionIds) {
        if (!groupedData.has(+id)) {
            groupedData.set(+id, {
                avgValues: {
                    sewer_and_water: null,
                    power: null,
                    roads_and_bridges: null,
                    medical: null,
                    buildings: null,
                    shake_intensity: null
                },
                medianValues: {
                    sewer_and_water: null,
                    power: null,
                    roads_and_bridges: null,
                    medical: null,
                    buildings: null,
                    shake_intensity: null
                },
                maxValues: {
                    sewer_and_water: null,
                    power: null,
                    roads_and_bridges: null,
                    medical: null,
                    buildings: null,
                    shake_intensity: null
                },
                reportCount: 0,
                nonNull: {
                    sewer_and_water: 0,
                    power: 0,
                    roads_and_bridges: 0,
                    medical: 0,
                    buildings: 0,
                    shake_intensity: 0
                }
            });
        }
    }
}