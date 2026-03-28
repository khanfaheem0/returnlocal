const fs = require('fs');
const html = fs.readFileSync('ui_stitch.html', 'utf8');
const match = html.match(/colors: ({[\s\S]*?})/);
if (!match) { console.log('No colors found'); process.exit(1); }

// Fix up the JS object to be valid JSON
let colorStr = match[1];
// Extract keys and values directly since JSON parsing JS objects with trailing commas and unquoted keys is flaky.
let css = '';
const regex = /"([^"]+)":\s*"([^"]+)"/g;
let m;
while ((m = regex.exec(colorStr)) !== null) {
    css += `  --color-${m[1]}: ${m[2]};\n`;
}

fs.writeFileSync('extracted_colors.css', css);
console.log('Done mapping colors');
