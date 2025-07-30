// Shared annotation style
const annotationStyle = {
    note: { label: "", title: "", wrap: 200, align: "middle" },
    connector: { end: "dot" },
    subject: { radius: 5 },
    type: d3.annotationCalloutCircle
  };
  
  // Tooltip logic
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
  
  function showTooltip(content, [x, y]) {
    tooltip.html(content)
      .style("left", `${x + 10}px`)
      .style("top", `${y - 30}px`)
      .style("visibility", "visible");
  }
  
  function moveTooltip([x, y]) {
    tooltip.style("left", `${x + 10}px`).style("top", `${y - 30}px`);
  }
  
  function hideTooltip() {
    tooltip.style("visibility", "hidden");
  }
  
  // Offset annotations dynamically
  function computeOffset(x, y, w, h) {
    let dx = 40, dy = -40;
    if (x < 100) dx = 80;
    if (x > w - 100) dx = -80;
    if (y < 60) dy = 60;
    if (y > h - 60) dy = -60;
    return { dx, dy };
  }
  
  Promise.all([
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),
    d3.csv("covid_data.csv", d3.autoType)
  ]).then(([us, data]) => {
    const mapSvg = d3.select("#mapScene").attr("viewBox", "0 0 960 500");
    const mapGroup = mapSvg.append("g");
  
    const path = d3.geoPath();
    const projection = d3.geoAlbersUsa().fitSize([960, 500], topojson.feature(us, us.objects.states));
  
    mapGroup.selectAll("path")
      .data(topojson.feature(us, us.objects.states).features)
      .join("path")
      .attr("fill", "#e0e0e0")
      .attr("stroke", "#999")
      .attr("d", d => path.projection(projection)(d));
  
    const seattle = projection([-122.3321, 47.6062]);
    if (seattle) {
      mapGroup.append("circle").attr("cx", seattle[0]).attr("cy", seattle[1]).attr("r", 6).attr("fill", "red");
      mapGroup.append("g")
        .style("overflow", "visible")
        .call(d3.annotation().annotations([{
          ...annotationStyle,
          x: seattle[0],
          y: seattle[1],
          dx: 80,
          dy: -40,
          note: {
            title: "First Case",
            label: "Jan 21, 2020 — Washington reports the first U.S. case"
          }
        }]));
    }
  
    // --- Scene 2 ---
    const svg2 = d3.select("#usTrend").attr("viewBox", "0 0 960 500");
    const group2 = svg2.append("g").attr("transform", "translate(50,20)");
  
    const timeline = Array.from(d3.rollup(data, v => d3.sum(v, d => d.Cases), d => d.Date))
      .map(([Date, Cases]) => ({ Date, Cases }));
  
    const x2 = d3.scaleTime().domain(d3.extent(timeline, d => d.Date)).range([0, 860]);
    const y2 = d3.scaleLinear().domain([0, d3.max(timeline, d => d.Cases)]).nice().range([460, 0]);
  
    group2.append("g").attr("transform", "translate(0,460)").call(d3.axisBottom(x2));
    group2.append("g").call(d3.axisLeft(y2));
  
    group2.append("path")
      .datum(timeline)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 2)
      .attr("d", d3.line().x(d => x2(d.Date)).y(d => y2(d.Cases)));
  
    group2.selectAll("circle")
      .data(timeline)
      .join("circle")
      .attr("cx", d => x2(d.Date))
      .attr("cy", d => y2(d.Cases))
      .attr("r", 3)
      .attr("fill", "steelblue")
      .on("mouseover", (e, d) => showTooltip(`Date: ${d.Date.toLocaleDateString()}<br>Cases: ${d.Cases}`, [e.pageX, e.pageY]))
      .on("mousemove", (e) => moveTooltip([e.pageX, e.pageY]))
      .on("mouseout", hideTooltip);
  
    const surge = timeline.find(d => d.Date.getFullYear() === 2020 && d.Date.getMonth() === 6);
    if (surge) {
      const x = x2(surge.Date), y = y2(surge.Cases);
      const { dx, dy } = computeOffset(x, y, 860, 460);
      group2.append("g").call(d3.annotation().annotations([{
        ...annotationStyle,
        x, y, dx, dy,
        note: {
          title: "Summer Surge",
          label: "July 2020 spike in daily cases."
        }
      }]));
    }
  
    // --- Scene 3 ---
    const svg3 = d3.select("#barChart").attr("viewBox", "0 0 960 500");
    const group3 = svg3.append("g").attr("transform", "translate(150,20)");
  
    const peaks = Array.from(d3.rollup(data, v => d3.max(v, d => d.Cases), d => d.State), ([State, Peak]) => ({ State, Peak }));
    const x3 = d3.scaleLinear().domain([0, d3.max(peaks, d => d.Peak)]).range([0, 700]);
    const y3 = d3.scaleBand().domain(peaks.map(d => d.State)).range([0, 460]).padding(0.1);
  
    group3.selectAll("rect")
      .data(peaks)
      .join("rect")
      .attr("y", d => y3(d.State))
      .attr("x", 0)
      .attr("height", y3.bandwidth())
      .attr("width", d => x3(d.Peak))
      .attr("fill", "#4caf50")
      .on("mouseover", (e, d) => showTooltip(`${d.State}<br>Peak: ${d.Peak}`, [e.pageX, e.pageY]))
      .on("mousemove", e => moveTooltip([e.pageX, e.pageY]))
      .on("mouseout", hideTooltip);
  
    group3.append("g").call(d3.axisLeft(y3).tickSize(0));
    group3.append("g").attr("transform", "translate(0,460)").call(d3.axisBottom(x3));
  
    const tx = peaks.find(d => d.State === "Texas");
    if (tx) {
      const x = x3(tx.Peak), y = y3(tx.State) + y3.bandwidth() / 2;
      const { dx, dy } = computeOffset(x, y, 700, 460);
      group3.append("g").call(d3.annotation().annotations([{
        ...annotationStyle,
        x, y, dx, dy,
        note: {
          title: "Texas Peak",
          label: "Texas had the highest peak."
        }
      }]));
    }
  
    // --- Scene 4 ---
    const svg4 = d3.select("#stateLineChart").attr("viewBox", "0 0 960 500");
    const group4 = svg4.append("g").attr("transform", "translate(50,20)");
  
    const dropdown = d3.select("#dropdown");
    const states = Array.from(new Set(data.map(d => d.State))).sort();
    dropdown.selectAll("option").data(states).enter().append("option").text(d => d);
  
    function renderState(state) {
      group4.selectAll("*").remove();
      const sdata = data.filter(d => d.State === state && d.Date instanceof Date);
      const x = d3.scaleTime().domain(d3.extent(sdata, d => d.Date)).range([0, 860]);
      const y = d3.scaleLinear().domain([0, d3.max(sdata, d => d.Cases)]).range([460, 0]).nice();
  
      group4.append("g").attr("transform", "translate(0,460)").call(d3.axisBottom(x));
      group4.append("g").call(d3.axisLeft(y));
  
      group4.append("path")
        .datum(sdata)
        .attr("fill", "none")
        .attr("stroke", "#ff9800")
        .attr("stroke-width", 2)
        .attr("d", d3.line().x(d => x(d.Date)).y(d => y(d.Cases)));
  
      group4.selectAll("circle")
        .data(sdata)
        .join("circle")
        .attr("cx", d => x(d.Date))
        .attr("cy", d => y(d.Cases))
        .attr("r", 3)
        .attr("fill", "#ff9800")
        .on("mouseover", (e, d) => showTooltip(`${d.Date.toLocaleDateString()}<br>${d.Cases}`, [e.pageX, e.pageY]))
        .on("mousemove", e => moveTooltip([e.pageX, e.pageY]))
        .on("mouseout", hideTooltip);
  
      const fall = sdata.find(d => d.Date.getMonth() === 10);
      if (fall) {
        const fx = x(fall.Date), fy = y(fall.Cases);
        const { dx, dy } = computeOffset(fx, fy, 860, 460);
        group4.append("g").call(d3.annotation().annotations([{
          ...annotationStyle,
          x: fx,
          y: fy,
          dx,
          dy,
          note: {
            title: "Fall Surge",
            label: `${state} cases rose in Fall 2020.`
          }
        }]));
      }
    }
  
    renderState(states[0]);
    dropdown.on("change", function () {
      renderState(this.value);
    });
  });
  