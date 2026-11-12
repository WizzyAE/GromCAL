// Recovered application components. The build script inserts these functions
// into the original bundle, where its JSX runtime (l) is available.
function Ms({bars, target, height = 150, highlight, goodOver}) {
  const positive = value => Number.isFinite(+value) ? Math.max(0, +value) : 0;
  const values = bars.map(bar => positive(bar.v));
  const goal = positive(target);
  const top = 16, bottom = height - 22;
  const maximum = values.reduce((max, value) => Math.max(max, value), Math.max(1, goal));
  const scale = maximum * 1.1;
  const slot = 340 / Math.max(1, bars.length);
  const width = slot * .56;
  const y = value => top + (1 - value / scale) * (bottom - top);
  return l.jsxs("svg", {
    viewBox: `0 0 340 ${height}`, width: "100%", role: "img",
    "aria-label": "Dnevne vrijednosti u posljednjih sedam dana",
    style: {display: "block"},
    children: [
      bars.map((bar, index) => {
        const value = values[index], x = slot * (index + .5);
        // A minimum visible bar must grow upwards from the baseline. The old
        // minimum height extended below it when one day dwarfed the others.
        const barHeight = value > 0 ? Math.min(bottom - top, Math.max(1, bottom - y(value))) : 0;
        const selected = highlight === index;
        const over = !goodOver && goal > 0 && value > goal * 1.05;
        return l.jsxs("g", {children: [
          l.jsx("title", {children: `${bar.label}: ${value}`}),
          l.jsx("rect", {x: x - width / 2, y: top, width, height: bottom - top, rx: width / 2.6, fill: "#1c1c1e"}),
          value > 0 && l.jsx("rect", {
            x: x - width / 2, y: bottom - barHeight, width, height: barHeight,
            rx: Math.min(width / 2.6, barHeight / 2),
            fill: over ? "#ff453a" : selected ? "#ffd60a" : "rgba(255,214,10,.55)"
          }),
          l.jsx("text", {x, y: height - 4, fill: selected ? "#fff" : "#5a5a5e", fontSize: "10", textAnchor: "middle", fontWeight: selected ? 700 : 400, children: bar.label})
        ]}, index);
      }),
      goal > 0 ? l.jsx("line", {x1: 0, x2: 340, y1: y(goal), y2: y(goal), stroke: "#fff", strokeOpacity: ".35", strokeDasharray: "4 5"}) : null
    ]
  });
}

function Th({earlier, session, goal, exercises}) {
  const positive = value => Number.isFinite(+value) ? Math.max(0, +value) : 0;
  const previous = positive(earlier), current = positive(session), target = positive(goal);
  const total = previous + current, scale = Math.max(1, target, total);
  const sorted = [...exercises].sort((a, b) => positive(b.kcal) - positive(a.kcal));
  const maximum = sorted.reduce((max, exercise) => Math.max(max, positive(exercise.kcal)), 1);
  const number = value => Math.round(value).toLocaleString("hr-HR");
  return l.jsxs("div", {
    className: "card rise training-consumption", style: Xt(240), children: [
      l.jsxs("div", {className: "between", children: [
        l.jsx("div", {className: "sub", style: {fontWeight: 600}, children: "Potrošnja danas"}),
        l.jsxs("div", {className: "sub num", children: ["cilj ", number(target)]})
      ]}),
      l.jsxs("div", {className: "training-total num", children: [
        l.jsx(Ot, {value: total, fmt: number}),
        l.jsxs("span", {className: "sub", children: [" kcal · ", target > 0 ? l.jsxs(l.Fragment, {children: [l.jsx(Ot, {value: total / target * 100, fmt: number}), "%"]}) : "bez cilja"]})
      ]}),
      l.jsxs("div", {style: {position: "relative"}, children: [
        l.jsxs("div", {className: "hbar training-stacked-bar", children: [
          l.jsx("i", {className: "gx", style: {width: previous / scale * 100 + "%", background: "var(--t3)"}}),
          l.jsx("i", {className: "gx", style: {...Xt(300), width: current / scale * 100 + "%", background: "var(--green)"}})
        ]}),
        target > 0 && l.jsx("div", {className: "training-goal-marker", style: {left: `calc(${target / scale * 100}% - 1px)`}})
      ]}),
      l.jsxs("div", {className: "training-legend", children: [
        l.jsxs("span", {children: [l.jsx("i", {style: {background: "var(--t3)"}}), "Ranije ", number(previous)]}),
        l.jsxs("span", {children: [l.jsx("i", {style: {background: "var(--green)"}}), "Trening ", number(current)]})
      ]}),
      sorted.length > 1 && l.jsx("div", {
        className: "training-exercise-chart", tabIndex: 0, role: "region",
        "aria-label": "Potrošnja po vježbama", children: sorted.map((exercise, index) =>
          l.jsxs("div", {className: "training-exercise-row", children: [
            l.jsxs("div", {className: "training-exercise-label", children: [
              l.jsxs("span", {title: exercise.name, children: [exercise.emoji, " ", exercise.name]}),
              l.jsx("span", {className: "num", children: number(positive(exercise.kcal))})
            ]}),
            l.jsx("div", {className: "hbar", children: l.jsx("i", {
              className: "gx", style: {
                ...Xt(Math.min(700, 350 + index * 40)),
                width: positive(exercise.kcal) / maximum * 100 + "%",
                background: "var(--green)", borderRadius: 99
              }
            })})
          ]}, exercise.id || index)
        )
      })
    ]
  });
}
