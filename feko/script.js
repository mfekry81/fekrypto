const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));