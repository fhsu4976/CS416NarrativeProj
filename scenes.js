// Annotation style used across all scenes
const annotationStyle = {
    note: { label: "", title: "", wrap: 200, align: "middle" },
    connector: { end: "dot" },
    subject: { radius: 5 },
    type: d3.annotationCalloutCircle
  };
  
  // Tooltip div
  const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("visibility", "hidden")
    .style("background", "#fff")
    .style("border", "1px solid #ccc")
    .style("padding", "8px")
    .style("border-radius", "4px")
    .style("font-size", "12px")
    .style("pointer-events", "none");
  
  function showTooltip(content, position) {
    tooltip.html(content)
      .style("top", `${position[1] - 40}px`)
      .style("left", `${position[0] + 10}px`)
      .style("visibility", "visible");
  }
  function moveTooltip(position) {
    tooltip.style("top", `${position[1] - 40}px`)
           .style("left", `${position[0] + 10}px`);
  }
  function hideTooltip() {
    tooltip.style("visibility", "hidden");
  }
  
  // Helper to compute safe annotation dx/dy
  function computeAnnotationOffsets(x, y, width, height) {
    let dx = 0, dy = -30;
    if (y < 40) dy = 30;
    if (x > width - 100) dx = -80;
    else if (x < 100) dx = 80;
    return { dx, dy };
  }
  
  // Load all data
  Promise.all([
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),
    d3.csv("covid_data.csv", d3.autoType)
  ]).then(([us, data]) => {
  
    // --- Scene 1: US map + first case annotation ---
    const svg1 = d3.select("#mapScene").attr("viewBox", "0 0 960 500").attr("preserveAspectRatio", "xMidYMid meet");
    const path = d3.geoPath();
    const usStates = topojson.feature(us, us.objects.states);
    const projection = d3.geoAlbersUsa().fitSize([960, 500], usStates);
    const mapGroup = svg1.append("g");
  
    mapGroup.selectAll("path")
      .data(usStates.features)
      .join("path")
      .attr("d", path.projection(projection))
      .attr("fill", "#e0e0e0")
      .attr("stroke", "#fff");
  
    const firstCase = data.find(d =>
      d.Date instanceof Date &&
      d.Date.getFullYear() === 2020 &&
      d.Date.getMonth() === 0 &&
      d.Date.getDate() === 21 &&
      d.State === "Washington"
    );
    const coords = projection([-122.3321, 47.6062]); // Seattle
  
    if (coords) {
      mapGroup.append("circle")
        .attr("cx", coords[0])
        .attr("cy", coords[1])
        .attr("r", 6)
        .attr("fill", "red");
  
      const mapAnnotation = d3.annotation().annotations([{
        ...annotationStyle,
        x: coords[0],
        y: coords[1],
        dx: 80,
        dy: -40,
        note: {
          title: "First Case",
          label: "Jan 21, 2020 – Washington reports first COVID case."
        }
      }]);
      mapGroup.append("g").call(mapAnnotation);
    }
  
    // --- Scene 2: US daily trend line ---
    const svg2 = d3.select("#usTrend").attr("viewBox", "0 0 960 500").attr("preserveAspectRatio", "xMidYMid meet");
    const trendGroup = svg2.append("g").attr("transform", "translate(50, 20)");
  
    const dailyCases = d3.rollup(data, v => d3.sum(v, d => d.Cases), d => d.Date);
    const timeSeries = Array.from(dailyCases, ([Date, Cases]) => ({ Date, Cases }));
  
    const width2 = 860, height2 = 460;
    const x2 = d3.scaleTime().domain(d3.extent(timeSeries, d => d.Date)).range([0, width2]);
    const y2 = d3.scaleLinear().domain([0, d3.max(timeSeries, d => d.Cases)]).nice().range([height2, 0]);
  
    trendGroup.append("g").attr("transform", `translate(0,${height2})`).call(d3.axisBottom(x2));
    trendGroup.append("g").call(d3.axisLeft(y2));
  
    trendGroup.append("path")
      .datum(timeSeries)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 2)
      .attr("d", d3.line().x(d => x2(d.Date)).y(d => y2(d.Cases)));
  
    trendGroup.selectAll("circle")
      .data(timeSeries)
      .join("circle")
      .attr("cx", d => x2(d.Date))
      .attr("cy", d => y2(d.Cases))
      .attr("r", 3)
      .attr("fill", "steelblue")
      .on("mouseover", (event, d) => {
        showTooltip(`<strong>${d.Date.toLocaleDateString()}</strong><br/>Cases: ${d.Cases.toLocaleString()}`, [event.pageX, event.pageY]);
      })
      .on("mousemove", (event) => moveTooltip([event.pageX, event.pageY]))
      .on("mouseout", hideTooltip);
  
    const summerX = x2(new Date("2020-07-01")), summerY = y2(60000);
    trendGroup.append("g").call(d3.annotation().annotations([{
      ...annotationStyle,
      x: summerX,
      y: summerY,
      dx: -100,
      dy: -40,
      note: {
        title: "Summer Surge",
        label: "July 2020 saw a dramatic increase in daily cases."
      }
    }]));
  
    // --- Scene 3: State peaks bar chart ---
    const svg3 = d3.select("#barChart").attr("viewBox", "0 0 960 500").attr("preserveAspectRatio", "xMidYMid meet");
    const barGroup = svg3.append("g").attr("transform", "translate(150, 20)");
  
    const peakByState = Array.from(
      d3.rollup(data, v => d3.max(v, d => d.Cases), d => d.State),
      ([State, Peak]) => ({ State, Peak })
    );
  
    const width3 = 700, height3 = 460;
    const x3 = d3.scaleLinear().domain([0, d3.max(peakByState, d => d.Peak)]).range([0, width3]);
    const y3 = d3.scaleBand().domain(peakByState.map(d => d.State)).range([0, height3]).padding(0.1);
  
    barGroup.selectAll("rect")
      .data(peakByState)
      .join("rect")
      .attr("x", 0)
      .attr("y", d => y3(d.State))
      .attr("width", d => x3(d.Peak))
      .attr("height", y3.bandwidth())
      .attr("fill", "#4caf50")
      .on("mouseover", (event, d) => {
        showTooltip(`<strong>${d.State}</strong><br/>Peak daily cases: ${d.Peak.toLocaleString()}`, [event.pageX, event.pageY]);
      })
      .on("mousemove", (event) => moveTooltip([event.pageX, event.pageY]))
      .on("mouseout", hideTooltip);
  
    barGroup.append("g").call(d3.axisLeft(y3).tickSize(0)).selectAll("text").attr("font-size", "10px");
    barGroup.append("g").attr("transform", `translate(0,${height3})`).call(d3.axisBottom(x3).ticks(6));
  
    const txY = y3("Texas") + y3.bandwidth() / 2;
    barGroup.append("g").call(d3.annotation().annotations([{
      ...annotationStyle,
      x: x3(peakByState.find(d => d.State === "Texas").Peak),
      y: txY,
      dx: -100,
      dy: -40,
      note: {
        title: "Highest Peak",
        label: "Texas recorded the highest daily case count."
      }
    }]));
  
    // --- Scene 4: Dropdown Line Chart ---
    const svg4 = d3.select("#stateLineChart").attr("viewBox", "0 0 960 500").attr("preserveAspectRatio", "xMidYMid meet");
    const lineGroup = svg4.append("g").attr("transform", "translate(50, 20)");
  
    const dropdown = d3.select("#dropdown");
    const stateList = Array.from(new Set(data.map(d => d.State))).sort();
    dropdown.selectAll("option").data(stateList).enter().append("option").text(d => d);
  
    const width4 = 860, height4 = 460;
  
    function drawStateChart(state) {
      lineGroup.selectAll("*").remove();
      const stateData = data.filter(d => d.State === state && d.Date instanceof Date);
      const x = d3.scaleTime().domain(d3.extent(stateData, d => d.Date)).range([0, width4]);
      const y = d3.scaleLinear().domain([0, d3.max(stateData, d => d.Cases)]).nice().range([height4, 0]);
  
      lineGroup.append("g").attr("transform", `translate(0,${height4})`).call(d3.axisBottom(x));
      lineGroup.append("g").call(d3.axisLeft(y));
  
      lineGroup.append("path")
        .datum(stateData)
        .attr("fill", "none")
        .attr("stroke", "#ff9800")
        .attr("stroke-width", 2)
        .attr("d", d3.line().x(d => x(d.Date)).y(d => y(d.Cases)));
  
      lineGroup.selectAll("circle")
        .data(stateData)
        .join("circle")
        .attr("cx", d => x(d.Date))
        .attr("cy", d => y(d.Cases))
        .attr("r", 3)
        .attr("fill", "#ff9800")
        .on("mouseover", (event, d) => {
          showTooltip(`<strong>${d.Date.toLocaleDateString()}</strong><br/>Cases: ${d.Cases.toLocaleString()}`, [event.pageX, event.pageY]);
        })
        .on("mousemove", (event) => moveTooltip([event.pageX, event.pageY]))
        .on("mouseout", hideTooltip);
  
      const fall = stateData.find(d => d.Date.getMonth() === 10);
      if (fall) {
        const fx = x(fall.Date), fy = y(fall.Cases);
        const {dx, dy} = computeAnnotationOffsets(fx, fy, width4, height4);
        lineGroup.append("g").call(d3.annotation().annotations([{
          ...annotationStyle,
          x: fx,
          y: fy,
          dx,
          dy,
          note: {
            title: "Fall Surge",
            label: `${state} saw rising cases in fall 2020.`
          }
        }]));
      }
    }
  
    drawStateChart(stateList[0]);
    dropdown.on("change", function () {
      drawStateChart(this.value);
    });
  });
  