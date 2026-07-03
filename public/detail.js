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

function showDetail() {
    d3.select("#heatmap-container").selectAll("*").remove();
    d3.select("#linechart-container").selectAll("*").remove();
    d3.select("#barchart-container").selectAll("*").remove();

    const regionData = timeFilteredData.filter(d => d.location == regionId);

    if (regionData.length == 0) {
        d3.select("#heatmap-container").append("p").text("No data available for the selected region and time range.")
            .style("color", "#555")
            .style("text-align", "center")
            .style("font-size", "20px");
        return;
    }

    regionData.sort((a, b) => a.time - b.time);

    // if (!activeCategories) { 
    //     activeCategories = new Set([currentCategory]) 
    // };

    showDetailHeatMap(regionData);
    showDetailBarChart(regionData);
    showDetailLineChart(regionData);
}

function showDetailLineChart(regionData) {
    const container = d3.select("#linechart-container");
    container.selectAll("*").remove();

    const margin = {top: 30, right: 120, bottom: 50, left: 40};
    const width = container.node().clientWidth - margin.left - margin.right;
    const height = container.node().clientHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const extent = d3.extent(regionData, d => d.time);
    const timeSpan = extent[1] - extent[0];

    let timeInterval;
    if (timeSpan <= 1 * 3600 * 1000) {          // 1 hour
        timeInterval = d3.timeMinute.every(5);      // every 5 minutes
    } else if (timeSpan <= 12 * 3600 * 1000) {  // 12 hours
        timeInterval = d3.timeHour.every(1);        // every hour
    } else if (timeSpan <= 24 * 3600 * 1000) {  // 24 hours
        timeInterval = d3.timeHour.every(2);        // every 2 hours
    } else {                                    // > 24 hours
        timeInterval = d3.timeHour.every(6);        // every 6 hours
    }

    const groupedData = d3.rollup(
        regionData,
        v => {
            let obj = {};
            reportCategories.forEach(cat => {
                obj[cat] = d3.median(v, d => d[cat]);
            });
            return obj;
        },
        d => timeInterval.ceil(d.time)
    );

    const linesData = reportCategories
        .filter(cat => activeCategories.has(cat))
        .map(cat => ({
            category: cat,
            values: Array.from(groupedData.entries()).map(([time, data]) => ({
                time,
                value: (data[cat] == null || data[cat] == undefined) ? -1 : data[cat]
            }))
        }));

    const x = d3.scaleTime()
        .domain(d3.extent(groupedData.keys()))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([-1, 10]) // -1 for no data
        .range([height, 0]);

    const line = d3.line()
        .x(d => x(d.time))
        .y(d => y(d.value))
        .curve(d3.curveLinear);

    const color = d3.scaleOrdinal()
        .domain(reportCategories)
        .range(Object.values(categoryColors));

    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x).ticks(10));

    const yAxis = d3.axisLeft(y)
        .tickValues(d3.range(-1,11))
        .tickFormat(d => d == -1 ? "N/A" : d);

    svg.append("g")
        .call(yAxis);

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 15)
        .text("Time")
        .style("font-size", "14px");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", `rotate(-90)`)
        .attr("x", -height / 2)
        .attr("y", -margin.left + 10)
        .text("Median Severity Value")
        .style("font-size", "14px");

    const lines = svg.selectAll(".line")
        .data(linesData)
        .enter()
        .append("g")
        .attr("class", ".line");

    lines.append("path")
        .attr("d", d => line(d.values))
        .style("stroke", d => color(d.category))
        .style("stroke-width", 2)
        .style("fill", "none");

    lines.append("text")
        .datum(d => ({category: d.category, value: d.values[d.values.length - 1]}))
        .attr("transform", d => `translate(${x(d.value.time)},${y(d.value.value)})`)
        .attr("x", 5)
        .style("font-size", "14px")
        .style("fill", d => color(d.category))
        .style("cursor", "pointer")
        .text(d => d.category.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()))
        .on("click", (event, d) => {
            if (activeCategories.has(d.category)) {
                activeCategories.delete(d.category);
            } else {
                activeCategories.add(d.category);
            }
            showDetailLineChart(regionData, activeCategories);
            showDetailBarChart(regionData, activeCategories);
        });

    const tooltip = d3.select("#tooltip");
    lines.selectAll("circle")
        .data(d => d.values.map(v => ({category: d.category, ...v})))
        .enter()
        .append("circle")
        .attr("cx", d => x(d.time))
        .attr("cy", d => y(d.value))
        .attr("r", 5)
        .style("fill", d => d.value == -1 ? "#ccc" : color(d.category))
        .on("mouseover", (event, d) => {
            tooltip.transition().style("opacity", 0.9);
            tooltip.html(`
                <strong>${d.category.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</strong><br/>
                Time: ${d3.timeFormat("%b %d %H:%M")(d.time)}<br/>
                Median: ${d.value == -1 ? "N/A" : d.value}
            `)
        })
        .on("mousemove", event => {
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 30) + "px");
        })
        .on("mouseout", () => {
            tooltip.transition().style("opacity", 0);
        });
}

function showDetailBarChart(regionData) {
    const container = d3.select("#barchart-container");
    container.selectAll("*").remove();

    const margin = {top: 30, right: 40, bottom: 50, left: 60};
    const width = container.node().clientWidth - margin.left - margin.right;
    const height = container.node().clientHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
 
    const severityCounts = {};
    for (let i = 0; i <= 10; i++) {
        severityCounts[i] = {};
        reportCategories.forEach(k => severityCounts[i][k] = 0);
    }
    regionData.forEach(d => {
        reportCategories.forEach(k => {
            const sev = d[k];
            if (sev != null) {
                severityCounts[sev][k] += 1;
            }
        });
    });

    const dataArray = Object.entries(severityCounts).map(([severity, counts]) => {
        const obj = { severity: +severity };
        reportCategories.forEach(k => obj[k] = counts[k]);
        return obj;
    });

    const x0 = d3.scaleBand()
        .domain(dataArray.map(d => d.severity))
        .range([0, width])
        .paddingInner(0.1);

    const x1 = d3.scaleBand()
        .domain(activeCategories)
        .range([0, x0.bandwidth()])
        .padding(0.05);

    const maxY = d3.max(dataArray, d => d3.max(activeCategories, k => d[k]));
    const y = d3.scaleLinear()
        .domain([0, maxY])
        .nice()
        .range([height, 0]);

    const color = d3.scaleOrdinal()
        .domain(reportCategories)
        .range(reportCategories.map(k => categoryColors[k]));

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x0));

    svg.append("g")
        .call(d3.axisLeft(y).ticks(Math.min(maxY, 10)).tickFormat(d3.format("d")));

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 15)
        .text("Severity")
        .style("font-size", "14px");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 20)
        .text("Number of Reports")
        .style("font-size", "14px");

    const barsGroup = svg.selectAll(".severity")
        .data(dataArray)
        .enter()
        .append("g")
        .attr("class", "severity")
        .attr("transform", d => `translate(${x0(d.severity)},0)`);

    const tooltip = d3.select("#tooltip");
    barsGroup.selectAll("rect")
        .data(d => Array.from(activeCategories).map(key => ({key: key, value: d[key], severity: d.severity})))
        .enter()
        .append("rect")
        .attr("x", d => x1(d.key))
        .attr("y", d => y(d.value))
        .attr("width", x1.bandwidth())
        .attr("height", d => height - y(d.value))
        .attr("fill", d => color(d.key))
        .on("mouseover", (event, d) => {
            tooltip.transition().style("opacity", 0.9);
            tooltip.html(`
                <strong>${d.key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</strong><br>
                Reports: ${d.value}
            `);
        })
        .on("mousemove", event => {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
            tooltip.transition().style("opacity", 0);
        });

    // Legend (Filter)
    const legend = svg.append("g").attr("transform", `translate(${width * 0.6}, 0)`);   

    reportCategories.forEach((key, i) => {
        const legendRow = legend.append("g")
            .attr("transform", `translate(${(i % 2) * 150}, ${Math.floor(i / 2) * 20})`)
            .style("cursor", "pointer")
            .on("click", () => {
                if (activeCategories.has(key)) {
                    activeCategories.delete(key);
                } else {
                    activeCategories.add(key);
                }
                showDetailBarChart(regionData, activeCategories);
                showDetailLineChart(regionData, activeCategories);
            });

        const isActive = activeCategories.has(key);
        legendRow.append("circle")
            .attr("r", 5)
            .attr("cx", 7)
            .attr("cy", 7)
            .attr("fill", isActive ? categoryColors[key] : "#ccc");

        legendRow.append("text")
            .datum(key)
            .attr("x", 20)
            .attr("y", 12)
            .text(key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()))
            .style("font-size", "14px")
            .attr("fill", isActive ? categoryColors[key] : "#ccc")
            .style("opacity", isActive ? 1 : 0.9);
    });
}

function showDetailHeatMap(regionData) {
    const container = d3.select("#heatmap-container");
    container.selectAll("*").remove();

    const margin = { top: 0, right: 40, bottom: 70, left: 120 };
    const width = container.node().clientWidth - margin.left - margin.right;
    const height = container.node().clientHeight - margin.top - margin.bottom;

    const timeStart = d3.min(timeFilteredData, d => d.time);
    const timeEnd = d3.max(timeFilteredData, d => d.time);
    const timeStep = 5 * 60 * 1000; // 5 minutes

    const times = [];
    for (let t = timeStart.getTime(); t <= timeEnd.getTime(); t += timeStep) {
        times.push(new Date(t));
    }

    const groupedByTime = d3.rollup(
        regionData,
        values => {
            const agg = {};
            reportCategories.forEach(cat => {
                const validValues = values.map(d => d[cat]).filter(v => v != null);
                agg[cat] = {
                    mean: validValues.length > 0 ? d3.mean(validValues) : null,
                    count: validValues.length
                };
            });
            return agg;
        },
        d => +d.time
    );

    const matrixData = [];
    times.forEach(time => {
        const aggValues = groupedByTime.get(time) || {};
        reportCategories.forEach(cat => {
            const entry = aggValues[cat] || { mean: null, count: 0 };
            matrixData.push({
                time,
                category: cat,
                value: entry.mean,
                count: entry.count
            });
        });
    });

    const xScale = d3.scaleBand()
        .domain(times)
        .range([0, width])
        .padding(0.05);

    const yScale = d3.scaleBand()
        .domain(reportCategories)
        .range([0, height])
        .padding(0.05);

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 10]);
    const tooltip = d3.select("#tooltip");

    svg.selectAll("rect")
        .data(matrixData)
        .enter()
        .append("rect")
        .attr("x", d => xScale(d.time))
        .attr("y", d => yScale(d.category))
        .attr("width", xScale.bandwidth())
        .attr("height", yScale.bandwidth())
        .attr("fill", d => d.count == 0 ? "#ccc" : (colorScale(d.value)))
        .on("mouseover", function (event, d) {
            tooltip.transition().style("opacity", 0.9);
            tooltip.html(`
                <strong>${d3.timeFormat("%b %d, %H:%M")(d.time)}</strong> <br>
                Mean: ${d.value != null ? d.value.toFixed(2) : "N/A"} <br>
                Reports: ${d.count}
            `);
        })
        .on("mousemove", (event) => {
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 30) + "px");
        })
        .on("mouseout", () => {
            tooltip.transition().style("opacity", 0);
        });

    const firstTime = times[0];
    const lastTime = times[times.length - 1];
    const intermediateTicks = times.filter((d, i) => 
        i % Math.ceil(times.length / 20) == 0 && d != firstTime && d != lastTime
    );
    const ticks = [firstTime, ...intermediateTicks, lastTime];

    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat("%b %d %H:%M")).tickValues(ticks))
        .selectAll("text")
        .attr("transform", "rotate(45)")
        .attr("font-size", "12px")
        .attr("color", "black")
        .style("text-anchor", "start");

    svg.append("g")
        .call(d3.axisLeft(yScale).tickFormat(cat => cat.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())))
        .selectAll("text")          
        .attr("font-size", "12px") 
        .attr("fill", d => categoryColors[d]); 
}

