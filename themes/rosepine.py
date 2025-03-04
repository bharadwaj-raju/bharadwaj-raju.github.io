COLORS = {
    "$surface": "#1f1d2e",
    "$love": "#eb6f92",
    "$rose": "#d7827e",
    "$gold": "#f6c177",
    "$pine": "#31748f",
    "$iris": "#c4a7e7",
    "$foam": "#9ccfd8",
    "$subtle": "#b3b3b3",
    "$highlightLow": "#21202e",
    "$highlightMed": "#21202e",
}

import pathlib

DOT = pathlib.Path(__file__).parent

with open(DOT / "rose-pine.tmTheme.template", "r") as f:
    contents = f.read()

for color in COLORS:
    contents = contents.replace(color, COLORS[color])

for line in contents.splitlines():
    if "$" in line:
        print("oops", line)

print(contents)
