const fs = require('fs');

const rawCSS = fs.readFileSync('extracted_colors.css', 'utf8');
const lines = rawCSS.split('\n').filter(l => l.trim());

const stitchColors = {};
for (const line of lines) {
    const match = line.match(/--color-(.+):\s*(#[a-fA-F0-9]+);/);
    if (match) {
        stitchColors[match[1]] = match[2];
    }
}

// Map Stitch colors to Shadcn UI variables
const shadcnMapping = {
    'background': stitchColors['background'],
    'foreground': stitchColors['on-background'],
    'card': stitchColors['surface-container-lowest'],
    'card-foreground': stitchColors['on-surface'],
    'popover': stitchColors['surface-container'],
    'popover-foreground': stitchColors['on-surface'],
    'primary': stitchColors['primary'],
    'primary-foreground': stitchColors['on-primary'],
    'secondary': stitchColors['secondary'],
    'secondary-foreground': stitchColors['on-secondary'],
    'muted': stitchColors['surface-variant'],
    'muted-foreground': stitchColors['on-surface-variant'],
    'accent': stitchColors['tertiary'],
    'accent-foreground': stitchColors['on-tertiary'],
    'destructive': stitchColors['error'],
    'destructive-foreground': stitchColors['on-error'],
    'border': stitchColors['outline-variant'],
    'input': stitchColors['outline-variant'],
    'ring': stitchColors['primary'],
};

let cssOutput = ':root {\n';
for (const [key, val] of Object.entries(shadcnMapping)) {
    if (val) cssOutput += `  --${key}: ${val};\n`;
}
cssOutput += '}\n';

fs.writeFileSync('shadcn_vars.css', cssOutput);
console.log('Done generating shadcn vars');
