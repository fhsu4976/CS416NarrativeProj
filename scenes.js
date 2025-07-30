const annotationStyle = {
    note: {
      label: "",
      title: "",
      wrap: 200,
      align: "middle"
    },
    type: d3.annotationCalloutCircle
  };
  
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
  function hideTooltip() {
    tooltip.style("display", "none");
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
    // Define margins and inner width/height for all scenes
    const margin = {top: 60, right: 60, bottom: 40, left: 60};
    const fullWidth = 960;
    const fullHeight = 500;
    const width = fullWidth - margin.left - margin.right;
    const height = fullHeight - margin.top - margin.bottom;
  
    // --- SCENE 1: US Map + First Case ---
    const svg1 = d3.select("#mapScene")
      .attr("viewBox", [0, 0, fullWidth, fullHeight])
      .style("overflow", "visible");
  
    const mapGroup = svg1.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  
    const usStates = topojson.feature(us, us.objects.states);
  
    const projection = d3.geoAlbersUsa().fitSize([width, height], usStates);
    const path = d3.geoPath().projection(projection);
  
    mapGroup.selectAll("path")
      .data(usStates.features)
      .join("path")
      .attr("fill", "#e0e0e0")
      .attr("stroke", "#fff")
      .attr("d", path);
  
    const seattleCoords = projection([-122.3321, 47.6062]);
  
    if (seattleCoords) {
      const [x, y] = seattleCoords;
  
      mapGroup.append("circle")
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", 7)
        .attr("fill", "red")
        .attr("stroke", "black")
        .attr("stroke-width", 1);
  
      let dx = 40, dy = -50;
      if (x + dx > width) dx = -70;
      if (y + dy < 0) dy = 40;
  
      mapGroup.append("g").call(
        d3.annotation().annotations([{
          ...annotationStyle,
          dx,
          dy,
          x,
          y,
          note: {
            title: "First Confirmed Case",
            label: "Jan 21, 2020 — Washington state reports the first COVID-19 case in the US."
          }
        }])
      );
    }
  
    // --- SCENE 2: US Trend Line Chart ---
    const svg2 = d3.select("#usTrend")
      .attr("viewBox", [0, 0, fullWidth, fullHeight])
      .style("overflow", "visible");
  
    const trendGroup = svg2.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  
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
      .range([0, width]);
  
    const y2 = d3.scaleLinear()
      .domain([0, d3.max(timeSeries, d => d.Cases)]).nice()
      .range([height, 0]);
  
    trendGroup.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x2));
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
      .attr("r", 4)
      .attr("fill", "steelblue")
      .attr("pointer-events", "all")
      .on("mouseover", (event, d) => {
        showTooltip(
          `<strong>${d.Date.toLocaleDateString()}</strong><br/>Cases: ${d.Cases.toLocaleString()}`,
          [event.pageX, event.pageY]
        );
      })
      .on("mouseout", hideTooltip);
  
    let annDx2 = 60, annDy2 = -60;
    const annX2 = x2(new Date("2020-07-01"));
    const annY2 = y2(60000);
    if (annX2 + annDx2 > width) annDx2 = -60;
    if (annY2 + annDy2 < 0) annDy2 = 60;
  
    trendGroup.append("g").call(
      d3.annotation().annotations([{
        ...annotationStyle,
        dx: annDx2,
        dy: annDy2,
        x: annX2,
        y: annY2,
        note: {
          title: "Summer Surge",
          label: "July 2020 saw a dramatic increase in daily cases."
        }
      }])
    );
  
    // --- SCENE 3: State Peak Bar Chart ---
    const svg3 = d3.select("#barChart")
      .attr("viewBox", [0, 0, fullWidth, fullHeight])
      .style("overflow", "visible");
  
    const barGroup = svg3.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  
    const peakByState = Array.from(
      d3.rollup(data, v => d3.max(v, d => d.Cases), d => d.State),
      ([State, Peak]) => ({ State, Peak })
    ).filter(d => !isNaN(d.Peak)).sort((a, b) => b.Peak - a.Peak);
  
    const x3 = d3.scaleLinear()
      .domain([0, d3.max(peakByState, d => d.Peak)]).nice()
      .range([0, width - 100]); // leave space for axis labels
  
    const y3 = d3.scaleBand()
      .domain(peakByState.map(d => d.State))
      .range([0, height])
      .padding(0.1);
  
    barGroup.append("g")
      .selectAll("rect")
      .data(peakByState)
      .join("rect")
      .attr("x", 100)
      .attr("y", d => y3(d.State))
      .attr("width", d => x3(d.Peak))
      .attr("height", y3.bandwidth())
      .attr("fill", "#4caf50")
      .attr("pointer-events", "all")
      .on("mouseover", (event, d) => {
        showTooltip(`<strong>${d.State}</strong><br/>Peak Cases: ${d.Peak.toLocaleString()}`, [event.pageX, event.pageY]);
      })
      .on("mouseout", hideTooltip);
  
    barGroup.append("g")
      .attr("transform", `translate(100,0)`)
      .call(d3.axisLeft(y3).tickSize(0))
      .selectAll("text")
      .attr("font-size", "10px");
  
    barGroup.append("g")
      .attr("transform", `translate(100,${height})`)
      .call(d3.axisBottom(x3).ticks(6));
  
    const texasY = y3("Texas");
    if (texasY !== undefined && !isNaN(texasY)) {
      let dx3 = 40, dy3 = -30;
      if (600 + dx3 > width) dx3 = -70;
      if (texasY + dy3 < 0) dy3 = 40;
  
      barGroup.append("g").call(
        d3.annotation().annotations([{
          ...annotationStyle,
          dx: dx3,
          dy: dy3,
          x: 600,
          y: texasY + y3.bandwidth() / 2,
          note: {
            title: "Highest Peak",
            label: "Texas recorded the highest daily case count."
          }
        }])
      );
    }
  
    // --- SCENE 4: State Line Chart with Dropdown ---
    const svg4 = d3.select("#stateLineChart")
      .attr("viewBox", [0, 0, fullWidth, fullHeight])
      .style("overflow", "visible");
  
    const lineGroup = svg4.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  
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
        .range([0, width]);
  
      const y4 = d3.scaleLinear()
        .domain([0, d3.max(stateData, d => d.Cases)]).nice()
        .range([height, 0]);
  
      lineGroup.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x4));
      lineGroup.append("g").call(d3.axisLeft(y4));
  
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
        .on("mouseout", hideTooltip);
  
      const nov = stateData.find(d => d.Date.getMonth() === 10);
      if (nov) {
        let dx4 = 50, dy4 = -50;
        const novX = x4(nov.Date);
        const novY = y4(nov.Cases);
        if (novX + dx4 > width) dx4 = -70;
        if (novY + dy4 < 0) dy4 = 40;
  
        lineGroup.append("g").call(
          d3.annotation().annotations([{
            ...annotationStyle,
            dx: dx4,
            dy: dy4,
            x: novX,
            y: novY,
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
  