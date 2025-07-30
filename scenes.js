const annotationStyle = {
    note: {
      label: "",
      title: "",
      wrap: 200,
      align: "middle"
    },
    type: d3.annotationCalloutCircle
  };
  
  // Tooltip setup
  const tooltip = d3.select("body").append("div")
    .attr("id", "tooltip")
    .style("position", "absolute")
    .style("padding", "8px")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .style("pointer-events", "none")
    .style("font-size", "13px")
    .style("display", "none")
    .style("box-shadow", "0 2px 5px rgba(0,0,0,0.2)");
  
  function showTooltip(html, [x, y]) {
    tooltip.html(html)
      .style("left", `${x + 10}px`)
      .style("top", `${y + 10}px`)
      .style("display", "block");
  }
  function moveTooltip([x, y]) {
    tooltip.style("left", `${x + 10}px`).style("top", `${y + 10}px`);
  }
  function hideTooltip() {
    tooltip.style("display", "none");
  }
  
  // Helper to compute safe annotation offsets to keep inside view
  function computeAnnotationOffsets(x, y, width, height, margin = 40) {
    let dx = 40, dy = -50;
    if (x + dx > width - margin) dx = -70;
    if (x + dx < margin) dx = 70;
    if (y + dy < margin) dy = 40;
    if (y + dy > height - margin) dy = -40;
    return {dx, dy};
  }
  
  Promise.all([
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),
    d3.csv("covid_data.csv", d => ({
      Date: new Date(d.date),
      State: d.state.trim(),
      FIPS: +d.fips,
      Cases: +d.cases,
      Deaths: +d.deaths
    }))
  ]).then(([us, data]) => {
    const fullWidth = 960;
    const fullHeight = 500;
  
    // ===== SCENE 1 =====
    const svg1 = d3.select("#mapScene")
      .attr("width", fullWidth)
      .attr("height", fullHeight)
      .attr("viewBox", `0 0 ${fullWidth} ${fullHeight}`)
      .style("overflow", "visible");
  
    svg1.selectAll("*").remove();
  
    const usStates = topojson.feature(us, us.objects.states);
  
    // Fit projection to full svg size (no margins)
    const projection = d3.geoAlbersUsa().fitSize([fullWidth, fullHeight], usStates);
    const path = d3.geoPath().projection(projection);
  
    svg1.selectAll("path")
      .data(usStates.features)
      .join("path")
      .attr("fill", "#e0e0e0")
      .attr("stroke", "#fff")
      .attr("d", path);
  
    const seattleCoords = projection([-122.3321, 47.6062]);
    if (seattleCoords) {
      const [x, y] = seattleCoords;
  
      svg1.append("circle")
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", 7)
        .attr("fill", "red")
        .attr("stroke", "black")
        .attr("stroke-width", 1);
  
      const {dx, dy} = computeAnnotationOffsets(x, y, fullWidth, fullHeight);
  
      svg1.append("g").call(
        d3.annotation().annotations([{
          ...annotationStyle,
          x, y,
          dx, dy,
          note: {
            title: "First Confirmed Case",
            label: "Jan 21, 2020 — Washington state's first COVID-19 case."
          }
        }])
      );
    }
  
    // ===== SCENE 2 =====
    const margin2 = {top: 60, right: 60, bottom: 50, left: 70};
    const width2 = fullWidth - margin2.left - margin2.right;
    const height2 = fullHeight - margin2.top - margin2.bottom;
  
    const svg2 = d3.select("#usTrend")
      .attr("width", fullWidth)
      .attr("height", fullHeight)
      .attr("viewBox", `0 0 ${fullWidth} ${fullHeight}`)
      .style("overflow", "visible");
  
    svg2.selectAll("*").remove();
  
    const trendGroup = svg2.append("g")
      .attr("transform", `translate(${margin2.left},${margin2.top})`);
  
    const dailyCases = d3.rollup(
      data,
      v => d3.sum(v, d => d.Cases),
      d => +d.Date
    );
  
    const timeSeries = Array.from(dailyCases, ([ts, cases]) => ({
      Date: new Date(ts),
      Cases: cases
    })).filter(d => d.Date instanceof Date && !isNaN(d.Cases));
  
    const x2 = d3.scaleTime()
      .domain(d3.extent(timeSeries, d => d.Date))
      .range([0, width2]);
  
    const y2 = d3.scaleLinear()
      .domain([0, d3.max(timeSeries, d => d.Cases)]).nice()
      .range([height2, 0]);
  
    trendGroup.append("g")
      .attr("transform", `translate(0,${height2})`)
      .call(d3.axisBottom(x2));
  
    trendGroup.append("g")
      .call(d3.axisLeft(y2));
  
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
      .attr("r", 4)
      .attr("fill", "steelblue")
      .attr("pointer-events", "all")
      .on("mouseover", (event, d) => {
        showTooltip(
          `<strong>${d.Date.toLocaleDateString()}</strong><br/>Cases: ${d.Cases.toLocaleString()}`,
          [event.pageX, event.pageY]
        );
      })
      .on("mousemove", (event) => {
        moveTooltip([event.pageX, event.pageY]);
      })
      .on("mouseout", hideTooltip);
  
    const annX2 = x2(new Date("2020-07-01"));
    const annY2 = y2(60000);
    const {dx: dx2, dy: dy2} = computeAnnotationOffsets(annX2, annY2, width2, height2);
  
    trendGroup.append("g").call(
      d3.annotation().annotations([{
        ...annotationStyle,
        x: annX2,
        y: annY2,
        dx: dx2,
        dy: dy2,
        note: {
          title: "Summer Surge",
          label: "July 2020 saw a dramatic increase in daily cases."
        }
      }])
    );
  
    // ===== SCENE 3 =====
    const margin3 = {top: 60, right: 60, bottom: 50, left: 100};
    const width3 = fullWidth - margin3.left - margin3.right;
    const height3 = fullHeight - margin3.top - margin3.bottom;
  
    const svg3 = d3.select("#barChart")
      .attr("width", fullWidth)
      .attr("height", fullHeight)
      .attr("viewBox", `0 0 ${fullWidth} ${fullHeight}`)
      .style("overflow", "visible");
  
    svg3.selectAll("*").remove();
  
    const barGroup = svg3.append("g")
      .attr("transform", `translate(${margin3.left},${margin3.top})`);
  
    const peakByState = Array.from(
      d3.rollup(data, v => d3.max(v, d => d.Cases), d => d.State),
      ([State, Peak]) => ({ State, Peak })
    ).filter(d => !isNaN(d.Peak)).sort((a, b) => b.Peak - a.Peak);
  
    const x3 = d3.scaleLinear()
      .domain([0, d3.max(peakByState, d => d.Peak)]).nice()
      .range([0, width3 - 100]);
  
    const y3 = d3.scaleBand()
      .domain(peakByState.map(d => d.State))
      .range([0, height3])
      .padding(0.1);
  
    barGroup.append("g")
      .selectAll("rect")
      .data(peakByState)
      .join("rect")
      .attr("x", 0)
      .attr("y", d => y3(d.State))
      .attr("width", d => x3(d.Peak))
      .attr("height", y3.bandwidth())
      .attr("fill", "#4caf50")
      .attr("pointer-events", "all")
      .on("mouseover", (event, d) => {
        showTooltip(`<strong>${d.State}</strong><br/>Peak Cases: ${d.Peak.toLocaleString()}`, [event.pageX, event.pageY]);
      })
      .on("mousemove", (event) => moveTooltip([event.pageX, event.pageY]))
      .on("mouseout", hideTooltip);
  
    barGroup.append("g")
      .call(d3.axisLeft(y3).tickSize(0))
      .selectAll("text")
      .attr("font-size", "10px");
  
    barGroup.append("g")
      .attr("transform", `translate(0,${height3})`)
      .call(d3.axisBottom(x3).ticks(6));
  
    // Texas annotation - stagger if you add more annotations here
    const texasY = y3("Texas");
    if (texasY !== undefined && !isNaN(texasY)) {
      const baseX = x3(d3.max(peakByState, d => d.Peak)) * 0.75;
      const baseY = texasY + y3.bandwidth() / 2;
      const {dx, dy} = computeAnnotationOffsets(baseX, baseY, width3, height3);
  
      barGroup.append("g").call(
        d3.annotation().annotations([{
          ...annotationStyle,
          x: baseX,
          y: baseY,
          dx,
          dy,
          note: {
            title: "Highest Peak",
            label: "Texas recorded the highest daily case count."
          }
        }])
      );
    }
  
    // ===== SCENE 4 =====
    const margin4 = {top: 60, right: 60, bottom: 50, left: 70};
    const width4 = fullWidth - margin4.left - margin4.right;
    const height4 = fullHeight - margin4.top - margin4.bottom;
  
    const svg4 = d3.select("#stateLineChart")
      .attr("width", fullWidth)
      .attr("height", fullHeight)
      .attr("viewBox", `0 0 ${fullWidth} ${fullHeight}`)
      .style("overflow", "visible");
  
    svg4.selectAll("*").remove();
  
    const lineGroup = svg4.append("g")
      .attr("transform", `translate(${margin4.left},${margin4.top})`);
  
    const dropdown = d3.select("#dropdown");
    const stateList = Array.from(new Set(data.map(d => d.State))).sort();
  
    dropdown.selectAll("option")
      .data(stateList)
      .enter().append("option")
      .text(d => d);
  
    function drawStateChart(selectedState) {
      lineGroup.selectAll("*").remove();
  
      const stateData = data.filter(d => d.State === selectedState && !isNaN(d.Cases));
  
      const x4 = d3.scaleTime()
        .domain(d3.extent(stateData, d => d.Date))
        .range([0, width4]);
  
      const y4 = d3.scaleLinear()
        .domain([0, d3.max(stateData, d => d.Cases)]).nice()
        .range([height4, 0]);
  
      lineGroup.append("g")
        .attr("transform", `translate(0,${height4})`)
        .call(d3.axisBottom(x4));
  
      lineGroup.append("g")
        .call(d3.axisLeft(y4));
  
      lineGroup.append("path")
        .datum(stateData)
        .attr("fill", "none")
        .attr("stroke", "#ff9800")
        .attr("stroke-width", 2)
        .attr("d", d3.line().x(d => x4(d.Date)).y(d => y4(d.Cases)));
  
      lineGroup.selectAll("circle")
        .data(stateData)
        .join("circle")
        .attr("cx", d => x4(d.Date))
        .attr("cy", d => y4(d.Cases))
        .attr("r", 4)
        .attr("fill", "#ff9800")
        .attr("pointer-events", "all")
        .on("mouseover", (event, d) => {
          showTooltip(
            `<strong>${d.Date.toLocaleDateString()}</strong><br/>Cases: ${d.Cases.toLocaleString()}`,
            [event.pageX, event.pageY]
          );
        })
        .on("mousemove", (event) => moveTooltip([event.pageX, event.pageY]))
        .on("mouseout", hideTooltip);
  
      // Annotation for November
      const nov = stateData.find(d => d.Date.getMonth() === 10);
      if (nov) {
        const novX = x4(nov.Date);
        const novY = y4(nov.Cases);
        const {dx, dy} = computeAnnotationOffsets(novX, novY, width4, height4);
  
        lineGroup.append("g").call(
          d3.annotation().annotations([{
            ...annotationStyle,
            x: novX,
            y: novY,
            dx,
            dy,
            note: {
              title: "Fall Surge",
              label: `${selectedState} saw rising cases in fall 2020.`
            }
          }])
        );
      }
    }
  
    drawStateChart(stateList[0]);
    dropdown.on("change", function () {
      drawStateChart(this.value);
    });
  });
  