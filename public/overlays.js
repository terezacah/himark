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

function drawBubbles(geoData, projection, svg, reportCategory) {
    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(Array.from(groupedData.values(), d => d.nonNull[reportCategory]))])
        .range([2, 30]);

    svg.selectAll("circle")
        .data(geoData.features)
        .enter()
        .append("circle")
        .attr("cx", d => projection(d3.geoCentroid(d))[0])
        .attr("cy", d => projection(d3.geoCentroid(d))[1])
        .attr("r", d => {
            const neighborhood = groupedData.get(d.properties.Id);
            return radiusScale(neighborhood.nonNull[reportCategory]);
        })
        .attr("fill", "white")
        .attr("opacity", 0.7)
        .attr("stroke", "black");
}

function drawBars(geoData, projection, svg, reportCategory) {
    geoData.features.forEach(d => {
        const values = timeFilteredData
            .filter(v => v.location == d.properties.Id)
            .map(v => v[reportCategory]);

        const severityCounts = Array(11).fill(0);
        values.forEach(v => severityCounts[v]++);

        const barScale = d3.scaleLinear()
            .domain([0, d3.max(severityCounts)])
            .range([0, 50]);

        const barWidth = 5;
        const barSpacing = 0.5;

        const [cx, cy] = projection(d3.geoCentroid(d));
        const x = cx - (severityCounts.length * (barWidth + barSpacing)) / 2;
        const y = cy + 20;

        svg.selectAll(`.bar-${d.properties.Id}`)
            .data(severityCounts)
            .enter()
            .append("rect")
            .attr("class", `bar-${d.properties.Id}`)
            .attr("x", (c, i) => x + i * (barWidth + barSpacing))
            .attr("y", c => y - barScale(c))
            .attr("width", barWidth)
            .attr("height", c => barScale(c))
            .attr("fill", "white")
            .attr("opacity", 0.7)
            .attr("stroke", "black");

        svg.append("line")
            .attr("x1", x)
            .attr("x2", x + severityCounts.length * (barWidth + barSpacing))
            .attr("y1", y)
            .attr("y2", y)
            .attr("stroke", "black")
            .attr("stroke-opacity", 0.7);
    });
}

function drawBoxPlots(geoData, projection, svg, reportCategory) {
    const boxData = new Map();
        
    timeFilteredData.forEach(d => {
        if (d[reportCategory] != null) {
            if (!boxData.has(d.location)) {
                boxData.set(d.location, []);
            }
            boxData.get(d.location).push(d[reportCategory]);
        }
    });

    const statistics = new Map();
    boxData.forEach((values, location) => {
        const sorted = values.sort(d3.ascending);
        const q1 = d3.quantile(sorted, 0.25);
        const median = d3.median(sorted);
        const q3 = d3.quantile(sorted, 0.75);
        const iqr = q3 - q1;
        const min = q1 - 1.5 * iqr;
        const max = q3 + 1.5 * iqr;
        statistics.set(location, { q1, median, q3, min, max });
    });

    const boxHeight = 70;
    const boxWidth = 20;

    const valueScale = d3.scaleLinear()
        .domain([0, 10]) // data values domain
        .range([boxHeight, 0]);

    geoData.features.forEach(d => {
        const location = d.properties.Id;
        const locationVals = boxData.get(location);
        const locationStats = statistics.get(location);
        if (!locationStats || !locationVals) { return };
    
        const [cx, cy] = projection(d3.geoCentroid(d));
        const x = cx;
        const y = cy - boxHeight / 2;
    
        // Vertical line
        svg.append("line")
            .attr("x1", x)
            .attr("x2", x)
            .attr("y1", y + valueScale(locationStats.min))
            .attr("y2", y + valueScale(locationStats.max))
            .attr("stroke", "#555")
            .attr("opacity", 0.9);;
    
        // Box
        svg.append("rect")
            .attr("x", x - boxWidth / 2)
            .attr("y", y + valueScale(locationStats.q3))
            .attr("width", boxWidth)
            .attr("height", valueScale(locationStats.q1) - valueScale(locationStats.q3))
            .attr("fill", "white")
            .attr("stroke", "#555")
            .attr("opacity", 0.9);
    
        // Median
        svg.append("line")
            .attr("x1", x - boxWidth / 2)
            .attr("x2", x + boxWidth / 2)
            .attr("y1", y + valueScale(locationStats.median))
            .attr("y2", y + valueScale(locationStats.median))
            .attr("stroke", "#007acc");
    
        // Min horizontal line
        svg.append("line")
            .attr("x1", x - 8)
            .attr("x2", x + 8)
            .attr("y1", y + valueScale(locationStats.min))
            .attr("y2", y + valueScale(locationStats.min))
            .attr("stroke", "#555");
    
        // Max horizontal line
        svg.append("line")
            .attr("x1", x - 8)
            .attr("x2", x + 8)
            .attr("y1", y + valueScale(locationStats.max))
            .attr("y2", y + valueScale(locationStats.max))
            .attr("stroke", "#555");
    
        // Outliers
        locationVals.forEach(v => {
            if (v < locationStats.min || v > locationStats.max) {
                svg.append("circle")
                    .attr("cx", x)
                    .attr("cy", y + valueScale(v))
                    .attr("r", 1.5)
                    .attr("fill", "#555");
            }
        });
    }); 
}