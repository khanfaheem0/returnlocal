const https = require('https');
const fs = require('fs');

https.get('https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2U5NThhYmRiOGQzZjQzM2U4NzhiMjIxMzBlYWU0YzFmEgsSBxC0ktqCmAwYAZIBJAoKcHJvamVjdF9pZBIWQhQxMjc3MDEzMTQxODgwOTYwMzQzNg&filename=&opi=96797242', (resp) => {
    let data = '';
    resp.on('data', (chunk) => { data += chunk; });
    resp.on('end', () => { fs.writeFileSync('ui_stitch.html', data); console.log("Done"); });
}).on("error", (err) => {
    console.log("Error: " + err.message);
});
