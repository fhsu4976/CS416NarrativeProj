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
    // SCENE 1: US Map + First Case Dot + Annotation
    const svg1 = d3.select("#mapScene")
      .attr("viewBox", [0, 0, 960, 500])
      .style("overflow", "visible");
  
    const usStates = topojson.feature(us, us.objects.states);
    const projection = d3.geoAlbersUsa().fitSize([960, 500], usStates);
    const path = d3.geoPath().projection(projection);
  
    svg1.append("g")
      .selectAll("path")
      .data(usStates.features)
      .join("path")
      .attr("fill", "#e0e0e0")
      .attr("stroke", "#fff")
      .attr("d", path);
  
    // Find first case record: Jan 21, 2020 Washington
    const firstCase = data.find(d =>
      d.Date.getFullYear() === 2020 &&
      d.Date.getMonth() === 0 &&
      d.Date.getDate() === 21 &&
      d.State === "Washington"
    );
  
    // Seattle coords
    const seattleCoords = projection([-122.3321, 47.6062]);
  
    if (seattleCoords) {
      svg1.append("circle")
        .attr("cx", seattleCoords[0])
        .attr("cy", seattleCoords[1])
        .attr("r", 7)
        .attr("fill", "red")
        .attr("stroke", "black")
        .attr("stroke-width", 1);
  
      svg1.append("g").call(
        d3.annotation().annotations([{
          ...annotationStyle,
          dx: 40,
          dy: -50,
          x: seattleCoords[0],
          y: seattleCoords[1],
          note: {
            title: "First Confirmed Case",
            label: "Jan 21, 2020 — Washington state reports the first COVID-19 case in the US."
          }
        }])
      );
    }
  
    // SCENE 2: US Trend Line Chart
    const svg2 = d3.select("#usTrend")
      .attr("viewBox", [0, 0, 960, 500])
      .style("overflow", "visible");
  
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
      .range([40, 920]);
  
    const y2 = d3.scaleLinear()
      .domain([0, d3.max(timeSeries, d => d.Cases)]).nice()
      .range([460, 40]);
  
    svg2.append("g").attr("transform", "translate(0,460)").call(d3.axisBottom(x2));
    svg2.append("g").attr("transform", "translate(40,0)").call(d3.axisLeft(y2));
  
    svg2.append("path")
      .datum(timeSeries)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 2)
      .attr("d", d3.line().x(d => x2(d.Date)).y(d => y2(d.Cases)));
  
    svg2.selectAll("circle")
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
  
    svg2.append("g").call(
      d3.annotation().annotations([{
        ...annotationStyle,
        dx: 60,
        dy: -60,
        x: x2(new Date("2020-07-01")),
        y: y2(60000),
        note: {
          title: "Summer Surge",
          label: "July 2020 saw a dramatic increase in daily cases."
        }
      }])
    );
  
    // SCENE 3: State Peak Bar Chart
    const svg3 = d3.select("#barChart")
      .attr("viewBox", [0, 0, 960, 500])
      .style("overflow", "visible");
  
    const peakByState = Array.from(
      d3.rollup(data, v => d3.max(v, d => d.Cases), d => d.State),
      ([State, Peak]) => ({ State, Peak })
    ).filter(d => !isNaN(d.Peak)).sort((a, b) => b.Peak - a.Peak);
  
    const x3 = d3.scaleLinear()
      .domain([0, d3.max(peakByState, d => d.Peak)]).nice()
      .range([0, 800]);
  
    const y3 = d3.scaleBand()
      .domain(peakByState.map(d => d.State))
      .range([0, 480])
      .padding(0.1);
  
    svg3.append("g")
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
  
    svg3.append("g")
      .attr("transform", "translate(100,0)")
      .call(d3.axisLeft(y3).tickSize(0))
      .selectAll("text").attr("font-size", "10px");
  
    svg3.append("g")
      .attr("transform", "translate(100,480)")
      .call(d3.axisBottom(x3).ticks(6));
  
    const texasY = y3("Texas");
    if (texasY !== undefined && !isNaN(texasY)) {
      svg3.append("g").call(
        d3.annotation().annotations([{
          ...annotationStyle,
          dx: 40,
          dy: -30,
          x: 600,
          y: texasY + y3.bandwidth() / 2,
          note: {
            title: "Highest Peak",
            label: "Texas recorded the highest daily case count."
          }
        }])
      );
    }
  
    // SCENE 4: State Line Chart with Dropdown
    const svg4 = d3.select("#stateLineChart")
      .attr("viewBox", [0, 0, 960, 500])
      .style("overflow", "visible");
  
    const dropdown = d3.select("#dropdown");
    const stateList = Array.from(new Set(data.map(d => d.State))).sort();
  
    dropdown.selectAll("option")
      .data(stateList)
      .enter().append("option")
      .text(d => d);
  
    function drawStateChart(selectedState) {
      svg4.selectAll("*").remove();
  
      const stateData = data.filter(d => d.State === selectedState && !isNaN(d.Cases));
  
      const x4 = d3.scaleTime()
        .domain(d3.extent(stateData, d => d.Date))
        .range([40, 920]);
  
      const y4 = d3.scaleLinear()
        .domain([0, d3.max(stateData, d => d.Cases)]).nice()
        .range([460, 40]);
  
      svg4.append("g").attr("transform", "translate(0,460)").call(d3.axisBottom(x4));
      svg4.append("g").attr("transform", "translate(40,0)").call(d3.axisLeft(y4));
  
      svg4.append("path")
        .datum(stateData)
        .attr("fill", "none")
        .attr("stroke", "#ff9800")
        .attr("stroke-width", 2)
        .attr("d", d3.line().x(d => x4(d.Date)).y(d => y4(d.Cases)));
  
      svg4.selectAll("circle")
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
        svg4.append("g").call(
          d3.annotation().annotations([{
            ...annotationStyle,
            dx: 50,
            dy: -50,
            x: x4(nov.Date),
            y: y4(nov.Cases),
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
  