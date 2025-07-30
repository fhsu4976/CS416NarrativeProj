const annotationStyle = {
    note: { label: "", title: "", wrap: 200, align: "middle" },
    connector: { end: "dot" },
    subject: { radius: 5 },
    type: d3.annotationCalloutCircle
  };
  
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
  
  function showTooltip(html, pos) {
    tooltip.html(html).style("visibility", "visible")
      .style("left", `${pos[0] + 10}px`).style("top", `${pos[1] - 30}px`);
  }
  function moveTooltip(pos) {
    tooltip.style("left", `${pos[0] + 10}px`).style("top", `${pos[1] - 30}px`);
  }
  function hideTooltip() {
    tooltip.style("visibility", "hidden");
  }
  
  function computeOffset(x, y, w, h) {
    let dx = 40, dy = -40;
    if (x < 80) dx = 80;
    if (x > w - 80) dx = -80;
    if (y < 60) dy = 60;
    if (y > h - 60) dy = -60;
    return { dx, dy };
  }
  
  Promise.all([
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),
    d3.csv("covid_data.csv", d3.autoType)
  ]).then(([us, data]) => {
    const fullW = 960, fullH = 500;
  
    // -------- SCENE 1 --------
    const svg1 = d3.select("#mapScene").attr("viewBox", `0 0 ${fullW} ${fullH}`);
    const proj = d3.geoAlbersUsa().fitSize([fullW, fullH], topojson.feature(us, us.objects.states));
    const path = d3.geoPath().projection(proj);
  
    svg1.selectAll("path").data(topojson.feature(us, us.objects.states).features)
      .join("path")
      .attr("d", path)
      .attr("fill", "#e0e0e0")
      .attr("stroke", "#fff");
  
    const seattle = proj([-122.3321, 47.6062]);
    if (seattle) {
      svg1.append("circle").attr("cx", seattle[0]).attr("cy", seattle[1])
        .attr("r", 6).attr("fill", "red");
      const { dx, dy } = computeOffset(seattle[0], seattle[1], fullW, fullH);
      svg1.append("g").call(d3.annotation().annotations([{
        ...annotationStyle,
        x: seattle[0], y: seattle[1],
        dx, dy,
        note: {
          title: "First Case",
          label: "Jan 21, 2020 — Washington reports first U.S. COVID‑19 case"
        }
      }]));
    }
  
    // -------- SCENE 2 --------
    const svg2 = d3.select("#usTrend").attr("viewBox", `0 0 ${fullW} ${fullH}`);
    const g2 = svg2.append("g").attr("transform", "translate(50,20)");
    const w2 = fullW - 100, h2 = fullH - 60;
  
    const ts = Array.from(d3.rollup(data, v => d3.sum(v, d => d.Cases), d => d.Date))
      .map(([Date, Cases]) => ({ Date, Cases }));
  
    const x2 = d3.scaleTime().domain(d3.extent(ts, d => d.Date)).range([0, w2]);
    const y2 = d3.scaleLinear().domain([0, d3.max(ts, d => d.Cases)]).nice().range([h2, 0]);
  
    g2.append("g").attr("transform", `translate(0,${h2})`).call(d3.axisBottom(x2));
    g2.append("g").call(d3.axisLeft(y2));
  
    g2.append("path").datum(ts)
      .attr("fill", "none").attr("stroke", "steelblue").attr("stroke-width", 2)
      .attr("d", d3.line().x(d => x2(d.Date)).y(d => y2(d.Cases)));
  
    g2.selectAll("circle").data(ts).join("circle")
      .attr("cx", d => x2(d.Date)).attr("cy", d => y2(d.Cases))
      .attr("r", 3).attr("fill", "steelblue")
      .on("mouseover", (e, d) => showTooltip(`${d.Date.toLocaleDateString()}<br>Cases: ${d.Cases.toLocaleString()}`, [e.pageX, e.pageY]))
      .on("mousemove", e => moveTooltip([e.pageX, e.pageY]))
      .on("mouseout", hideTooltip);
  
    const surge = ts.filter(d => d.Date.getFullYear() === 2020 && d.Date.getMonth() === 6);
    const ann2 = surge.map(d => ({
      x: x2(d.Date), y: y2(d.Cases),
      title: "Summer Surge", label: "July 2020 spike"
    }));
  
    ann2.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ann2.length; i++) {
      if (ann2[i].y - ann2[i - 1].y < 40) {
        ann2[i].y = ann2[i - 1].y + 40;
      }
    }
    ann2.forEach(a => {
      const { dx, dy } = computeOffset(a.x, a.y, w2, h2);
      g2.append("g").call(d3.annotation().annotations([{
        ...annotationStyle,
        x: a.x, y: a.y, dx, dy,
        note: { title: a.title, label: a.label }
      }]));
    });
  
    // -------- SCENE 3 --------
    const svg3 = d3.select("#barChart").attr("viewBox", `0 0 ${fullW} ${fullH}`);
    const g3 = svg3.append("g").attr("transform", "translate(150,20)");
    const w3 = fullW - 200, h3 = fullH - 60;
  
    const peaks = Array.from(d3.rollup(data, v => d3.max(v, d => d.Cases), d => d.State),
      ([State, Peak]) => ({ State, Peak }));
    const x3 = d3.scaleLinear().domain([0, d3.max(peaks, d => d.Peak)]).range([0, w3]);
    const y3 = d3.scaleBand().domain(peaks.map(d => d.State)).range([0, h3]).padding(0.1);
  
    g3.append("g").selectAll("rect")
      .data(peaks).join("rect")
      .attr("y", d => y3(d.State)).attr("x", 0)
      .attr("width", d => x3(d.Peak)).attr("height", y3.bandwidth())
      .attr("fill", "#4caf50")
      .on("mouseover", (e, d) => showTooltip(`${d.State}<br>Peak: ${d.Peak.toLocaleString()}`, [e.pageX, e.pageY]))
      .on("mousemove", e => moveTooltip([e.pageX, e.pageY]))
      .on("mouseout", hideTooltip);
  
    g3.append("g").call(d3.axisLeft(y3).tickSize(0));
    g3.append("g").attr("transform", `translate(0,${h3})`).call(d3.axisBottom(x3).ticks(6));
  
    const tx = peaks.find(d => d.State === "Texas");
    const ann3 = [{
      x: x3(tx.Peak),
      y: y3(tx.State) + y3.bandwidth() / 2,
      title: "Texas Peak",
      label: "Texas had the highest peak"
    }];
    ann3.sort((a, b) => a.y - b.y);
    ann3.forEach(a => {
      const { dx, dy } = computeOffset(a.x, a.y, w3, h3);
      g3.append("g").call(d3.annotation().annotations([{
        ...annotationStyle,
        x: a.x, y: a.y, dx, dy,
        note: { title: a.title, label: a.label }
      }]));
    });
  
    // -------- SCENE 4 --------
    const svg4 = d3.select("#stateLineChart").attr("viewBox", `0 0 ${fullW} ${fullH}`);
    const g4 = svg4.append("g").attr("transform", "translate(50,20)");
    const w4 = fullW - 100, h4 = fullH - 60;
  
    const dropdown = d3.select("#dropdown");
    const states = Array.from(new Set(data.map(d => d.State))).sort();
    dropdown.selectAll("option").data(states).enter().append("option").text(d => d);
  
    function drawState(stateName) {
      g4.selectAll("*").remove();
      const sd = data.filter(d => d.State === stateName && d.Date instanceof Date);
      const x = d3.scaleTime().domain(d3.extent(sd, d => d.Date)).range([0, w4]);
      const y = d3.scaleLinear().domain([0, d3.max(sd, d => d.Cases)]).nice().range([h4, 0]);
  
      g4.append("g").attr("transform", `translate(0,${h4})`).call(d3.axisBottom(x));
      g4.append("g").call(d3.axisLeft(y));
  
      g4.append("path").datum(sd)
        .attr("fill", "none")
        .attr("stroke", "#ff9800")
        .attr("stroke-width", 2)
        .attr("d", d3.line().x(d => x(d.Date)).y(d => y(d.Cases)));
  
      g4.selectAll("circle").data(sd).join("circle")
        .attr("cx", d => x(d.Date)).attr("cy", d => y(d.Cases))
        .attr("r", 3).attr("fill", "#ff9800")
        .on("mouseover", (e, d) => showTooltip(`${d.Date.toLocaleDateString()}<br>Cases: ${d.Cases.toLocaleString()}`, [e.pageX, e.pageY]))
        .on("mousemove", e => moveTooltip([e.pageX, e.pageY]))
        .on("mouseout", hideTooltip);
  
      const fallPts = sd.filter(d => d.Date.getMonth() === 10);
      const ann4 = fallPts.map(d => ({
        x: x(d.Date), y: y(d.Cases),
        title: "Fall Surge", label: `${stateName} saw rising cases in fall 2020`
      }));
  
      ann4.sort((a, b) => a.y - b.y);
      for (let i = 1; i < ann4.length; i++) {
        if (ann4[i].y - ann4[i - 1].y < 40) {
          ann4[i].y = ann4[i - 1].y + 40;
        }
      }
  
      ann4.forEach(a => {
        const { dx, dy } = computeOffset(a.x, a.y, w4, h4);
        g4.append("g").call(d3.annotation().annotations([{
          ...annotationStyle,
          x: a.x, y: a.y, dx, dy,
          note: { title: a.title, label: a.label }
        }]));
      });
    }
  
    drawState(states[0]);
    dropdown.on("change", function () {
      drawState(this.value);
    });
  });
  