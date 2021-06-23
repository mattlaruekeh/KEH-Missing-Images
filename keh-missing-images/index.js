const scrape = require('./scrape');

const app = async () => { 
    await scrape.app(); 
}

app();