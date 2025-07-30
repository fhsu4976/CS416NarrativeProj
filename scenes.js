// Annotation style shared across scenes
const annotationStyle = {
    note: {
      label: "",
      title: "",
      wrap: 200,
      align: "middle"
    },
    dy: -30,
    dx: 0,
    type: d3.annotationCalloutCircle
  };
  
  // Load topoJSON + COVID CSV
  Promise.all([
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),
    d3.csv("covid_data.csv", d => ({
      Date: new Date(d.date),
      State: d.state.trim(),
      Cases: +d.cases,
      Deaths: +d.deaths,
      FIPS: +d.fips
    }))
  ]).then(([us, data]) => {
    // ---------------- Scene 1: US Map ----------------
    const svg1 = d3.select("#mapScene").attr("viewBox", [0, 0, 960, 500]);
    const usStates = topojson.feature(us, us.objects.states);
    const path = d3.geoPath();
    const projection = d3.geoAlbersUsa().fitSize([960, 500], usStates);
  
    svg1.append("g")
      .selectAll("path")
      .data(usStates.features)
      .join("path")
      .attr("fill", "#e0e0e0")
      .attr("stroke", "#fff")
      .attr("d", path);
  
    const firstCase = data.find(d =>
      d.Date.getFullYear() === 2020 &&
      d.Date.getMonth() === 0 &&
      d.Date.getDate() === 21 &&
      d.State === "Washington"
    );
  
    const coords = projection([-122.3321, 47.6062]); // Seattle
  
    if (firstCase && coords) {
      svg1.append("circle")
        .attr("cx", coords[0])
        .attr("cy", coords[1])
        .attr("r", 6)
        .attr("fill", "red");
  
      svg1.append("g").call(
        d3.annotation().annotations([{
          ...annotationStyle,
          x: coords[0],
          y: coords[1],
          note: {
            title: "First Case",
            label: "Jan 21, 2020 – Washington reports first COVID case."
          }
        }])
      );
    }
  
    // ---------------- Scene 2: National Trend ----------------
    const svg2 = d3.select("#usTrend").attr("viewBox", [0, 0, 960, 500]);
  
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
      .attr("d", d3.line()
        .x(d => x2(d.Date))
        .y(d => y2(d.Cases))
      );
  
    const surgeDate = new Date("2020-07-01");
    const surgeY = y2(60000);
    if (!isNaN(surgeY)) {
      svg2.append("g").call(
        d3.annotation().annotations([{
          ...annotationStyle,
          x: x2(surgeDate),
          y: surgeY,
          note: {
            title: "Summer Surge",
            label: "July 2020 saw a dramatic increase in daily cases."
          }
        }])
      );
    }
  
    // ---------------- Scene 3: State Peak Bar Chart ----------------
    const svg3 = d3.select("#barChart").attr("viewBox", [0, 0, 960, 500]);
  
    const peakByState = Array.from(
      d3.rollup(
        data,
        v => d3.max(v, d => d.Cases),
        d => d.State
      ),
      ([State, Peak]) => ({ State, Peak })
    ).filter(d => !isNaN(d.Peak));
  
    peakByState.sort((a, b) => b.Peak - a.Peak);
  
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
      .attr("fill", "#4caf50");
  
    svg3.append("g")
      .attr("transform", "translate(100,0)")
      .call(d3.axisLeft(y3).tickSize(0))
      .selectAll("text")
      .attr("font-size", "10px");
  
    svg3.append("g")
      .attr("transform", "translate(100,480)")
      .call(d3.axisBottom(x3).ticks(6));
  
    const texasY = y3("Texas");
    if (texasY !== undefined && !isNaN(texasY)) {
      svg3.append("g").call(
        d3.annotation().annotations([{
          ...annotationStyle,
          x: 600,
          y: texasY + y3.bandwidth() / 2,
          note: {
            title: "Highest Peak",
            label: "Texas recorded the highest daily case count."
          }
        }])
      );
    }
  
    // ---------------- Scene 4: Dropdown State Line Chart ----------------
    const svg4 = d3.select("#stateLineChart").attr("viewBox", [0, 0, 960, 500]);
    const dropdown = d3.select("#dropdown");
    const stateList = Array.from(new Set(data.map(d => d.State))).sort();
  
    dropdown.selectAll("option")
      .data(stateList)
      .enter()
      .append("option")
      .text(d => d);
  
    function drawStateChart(selectedState) {
      svg4.selectAll("*").remove();
  
      const stateData = data.filter(d => d.State === selectedState && !isNaN(d.Cases));
      if (stateData.length === 0) return;
  
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
        .attr("d", d3.line()
          .x(d => x4(d.Date))
          .y(d => y4(d.Cases))
        );
  
      const novPoint = stateData.find(d => d.Date.getMonth() === 10); // November
      if (novPoint) {
        const yVal = y4(novPoint.Cases);
        if (!isNaN(yVal)) {
          svg4.append("g").call(
            d3.annotation().annotations([{
              ...annotationStyle,
              x: x4(novPoint.Date),
              y: yVal,
              note: {
                title: "Fall Surge",
                label: `${selectedState} saw rising cases in fall 2020.`
              }
            }])
          );
        }
      }
    }
  
    drawStateChart(stateList[0]);
    dropdown.on("change", function () {
      drawStateChart(this.value);
    });
  });
  