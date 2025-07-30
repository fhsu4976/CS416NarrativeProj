const annotationStyle = {
    note: { label: "", title: "", wrap: 180 },
    connector: { end: "arrow" },
    subject: { radius: 4 },
    type: d3.annotationCalloutElbow
  };
  
  // Tooltip setup
  const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "#fff")
    .style("border", "1px solid #ccc")
    .style("padding", "8px")
    .style("border-radius", "4px")
    .style("font-size", "12px")
    .style("pointer-events", "none")
    .style("visibility", "hidden");
  
  function showTooltip(content, event) {
    tooltip.html(content)
      .style("left", `${event.pageX + 10}px`)
      .style("top", `${event.pageY - 40}px`)
      .style("visibility", "visible");
  }
  
  function moveTooltip(event) {
    tooltip.style("left", `${event.pageX + 10}px`)
           .style("top", `${event.pageY - 40}px`);
  }
  
  function hideTooltip() {
    tooltip.style("visibility", "hidden");
  }
  
  Promise.all([
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),
    d3.csv("covid_data.csv", d3.autoType)
  ]).then(([us, data]) => {
    // Scene 1
    const svg1 = d3.select("#mapScene")
      .attr("viewBox", "0 0 960 500")
      .attr("preserveAspectRatio", "xMidYMid meet");
  
    const path = d3.geoPath();
    const usStates = topojson.feature(us, us.objects.states);
    const projection = d3.geoAlbersUsa().fitSize([960, 500], usStates);
  
    svg1.append("g")
      .selectAll("path")
      .data(usStates.features)
      .join("path")
      .attr("fill", "#e0e0e0")
      .attr("stroke", "#fff")
      .attr("d", d => path.projection(projection)(d));
  
    const first = data.find(d =>
      d.Date instanceof Date &&
      d.Date.getFullYear() === 2020 &&
      d.Date.getMonth() === 0 &&
      d.Date.getDate() === 21 &&
      d.State === "Washington"
    );
  
    const coords = projection([-122.3321, 47.6062]);
    if (coords) {
      svg1.append("circle")
        .attr("cx", coords[0])
        .attr("cy", coords[1])
        .attr("r", 6)
        .attr("fill", "red");
  
      svg1.append("g")
        .call(d3.annotation().annotations([{
          ...annotationStyle,
          x: coords[0],
          y: coords[1],
          dx: 90,
          dy: -60,
          note: {
            title: "First Case",
            label: "Jan 21, 2020 — First U.S. COVID-19 case reported in Washington."
          }
        }]));
    }
  
    // Scene 2
    const svg2 = d3.select("#usTrend")
      .attr("viewBox", "0 0 960 500")
      .attr("preserveAspectRatio", "xMidYMid meet");
  
    const g2 = svg2.append("g").attr("transform", "translate(50, 20)");
    const daily = d3.rollup(data, v => d3.sum(v, d => d.Cases), d => d.Date);
    const series = Array.from(daily, ([Date, Cases]) => ({ Date, Cases }));
  
    const x2 = d3.scaleTime().domain(d3.extent(series, d => d.Date)).range([0, 860]);
    const y2 = d3.scaleLinear().domain([0, d3.max(series, d => d.Cases)]).nice().range([460, 0]);
  
    g2.append("g").attr("transform", "translate(0,460)").call(d3.axisBottom(x2));
    g2.append("g").call(d3.axisLeft(y2));
  
    g2.append("path")
      .datum(series)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 2)
      .attr("d", d3.line().x(d => x2(d.Date)).y(d => y2(d.Cases)));
  
    g2.selectAll("circle")
      .data(series)
      .join("circle")
      .attr("cx", d => x2(d.Date))
      .attr("cy", d => y2(d.Cases))
      .attr("r", 2)
      .attr("fill", "steelblue")
      .on("mouseover", (e, d) => showTooltip(`<strong>${d.Date.toLocaleDateString()}</strong><br/>Cases: ${d.Cases}`, e))
      .on("mousemove", moveTooltip)
      .on("mouseout", hideTooltip);
  
    g2.append("g").call(d3.annotation().annotations([{
      ...annotationStyle,
      x: x2(new Date("2020-07-01")),
      y: y2(60000),
      dx: -120,
      dy: -60,
      note: {
        title: "Summer Surge",
        label: "Major rise in daily cases across the U.S. during July 2020."
      }
    }]));
  
    // Scene 3
    const svg3 = d3.select("#barChart")
      .attr("viewBox", "0 0 960 500")
      .attr("preserveAspectRatio", "xMidYMid meet");
  
    const g3 = svg3.append("g").attr("transform", "translate(160, 20)");
    const peaks = Array.from(
      d3.rollup(data, v => d3.max(v, d => d.Cases), d => d.State),
      ([State, Peak]) => ({ State, Peak })
    ).sort((a, b) => b.Peak - a.Peak);
  
    const x3 = d3.scaleLinear().domain([0, d3.max(peaks, d => d.Peak)]).range([0, 700]);
    const y3 = d3.scaleBand().domain(peaks.map(d => d.State)).range([0, 460]).padding(0.1);
  
    g3.selectAll("rect")
      .data(peaks)
      .join("rect")
      .attr("x", 0)
      .attr("y", d => y3(d.State))
      .attr("width", d => x3(d.Peak))
      .attr("height", y3.bandwidth())
      .attr("fill", "#4caf50")
      .on("mouseover", (e, d) => showTooltip(`<strong>${d.State}</strong><br/>Peak daily cases: ${d.Peak}`, e))
      .on("mousemove", moveTooltip)
      .on("mouseout", hideTooltip);
  
    g3.append("g").call(d3.axisLeft(y3));
    g3.append("g").attr("transform", "translate(0,460)").call(d3.axisBottom(x3).ticks(5));
  
    const texas = peaks.find(d => d.State === "Texas");
    g3.append("g").call(d3.annotation().annotations([{
      ...annotationStyle,
      x: x3(texas.Peak),
      y: y3("Texas") + y3.bandwidth() / 2,
      dx: -120,
      dy: -50,
      note: {
        title: "Highest Peak",
        label: "Texas reported the highest single-day case count."
      }
    }]));
  
    // Scene 4
    const svg4 = d3.select("#stateLineChart")
      .attr("viewBox", "0 0 960 500")
      .attr("preserveAspectRatio", "xMidYMid meet");
    const g4 = svg4.append("g").attr("transform", "translate(50, 20)");
  
    const dropdown = d3.select("#dropdown");
    const states = Array.from(new Set(data.map(d => d.State))).sort();
    dropdown.selectAll("option").data(states).enter().append("option").text(d => d);
  
    function drawLine(state) {
      g4.selectAll("*").remove();
      const stateData = data.filter(d => d.State === state && d.Date instanceof Date);
      const x4 = d3.scaleTime().domain(d3.extent(stateData, d => d.Date)).range([0, 860]);
      const y4 = d3.scaleLinear().domain([0, d3.max(stateData, d => d.Cases)]).nice().range([460, 0]);
  
      g4.append("g").attr("transform", "translate(0,460)").call(d3.axisBottom(x4));
      g4.append("g").call(d3.axisLeft(y4));
  
      g4.append("path")
        .datum(stateData)
        .attr("fill", "none")
        .attr("stroke", "#ff9800")
        .attr("stroke-width", 2)
        .attr("d", d3.line().x(d => x4(d.Date)).y(d => y4(d.Cases)));
  
      g4.selectAll("circle")
        .data(stateData)
        .join("circle")
        .attr("cx", d => x4(d.Date))
        .attr("cy", d => y4(d.Cases))
        .attr("r", 2)
        .attr("fill", "#ff9800")
        .on("mouseover", (e, d) => showTooltip(`<strong>${d.Date.toLocaleDateString()}</strong><br/>Cases: ${d.Cases}`, e))
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);
  
      const fall = stateData.find(d => d.Date.getMonth() === 10);
      if (fall) {
        g4.append("g").call(d3.annotation().annotations([{
          ...annotationStyle,
          x: x4(fall.Date),
          y: y4(fall.Cases),
          dx: -80,
          dy: -50,
          note: {
            title: "Fall Surge",
            label: `${state} saw case spikes in Fall 2020.`
          }
        }]));
      }
    }
  
    drawLine(states[0]);
    dropdown.on("change", function () {
      drawLine(this.value);
    });
  });
  