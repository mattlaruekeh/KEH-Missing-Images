// External dependencies
const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')
const rp = require('promise-request-retry');
const chalk = require('chalk')
const excel = require('exceljs');
let csvToJson = require('convert-csv-to-json');

// get json from the sales data sheet from tableau for prioritization of models
let json = csvToJson.getJsonFromCsv("modelData.csv");

// new excel doc
let workbook = new excel.Workbook()
let worksheet = workbook.addWorksheet('Missing Images')
worksheet.columns = [
    { header: 'Product Name', key: 'productName' },
    { header: 'KEH Model Number: ', key: 'modelNumber' },
    { header: 'SKU_ID', key: 'skuID' },
    { header: 'Price', key: 'productPrice' },
    { header: 'Category', key: 'productCategory' },
    { header: 'Class', key: 'productClass' },
    { header: 'Quantity', key: 'productQuantity' },
    { header: 'Product Item Link', key: 'productItemLink' },
    { header: 'Found at URL', key: 'urlLocated' }
]


// force the columns to be at least as long as their header row.
worksheet.columns.forEach(column => {
    column.width = column.header.length < 12 ? 12 : column.header.length
    column.font = {
        name: 'Arial', size: 14
    }
})

// Make the header bold.
worksheet.getRow(1).font = { name: 'Arial', bold: true, size: 14 }

const keplerURLS = [
    "https://kepler1649c.keh.com/shop/cameras/digital-cameras.html",
    "https://kepler1649c.keh.com/shop/cameras/film-cameras.html",
    "https://kepler1649c.keh.com/shop/lenses.html",
    "https://kepler1649c.keh.com/shop/accessories.html",
    "https://kepler1649c.keh.com/shop/tripods-monopods.html",
    "https://kepler1649c.keh.com/shop/lighting.html",
    "https://kepler1649c.keh.com/shop/video.html",
    "https://kepler1649c.keh.com/shop/more.html"
]

const productionURLS = [
    "https://keh.com/shop/cameras/digital-cameras.html",
    "https://keh.com/shop/cameras/film-cameras.html",
    "https://keh.com/shop/lenses.html",
    "https://keh.com/shop/accessories.html",
    "https://keh.com/shop/tripods-monopods.html",
    "https://keh.com/shop/lighting.html",
    "https://keh.com/shop/video.html",
    "https://keh.com/shop/more.html"
]
const rossURLS = [
    "https://ross128b.keh.com/shop/cameras/digital-cameras.html",
    "https://ross128b.keh.com/shop/cameras/film-cameras.html",
    "https://ross128b.keh.com/shop/lenses.html",
    "https://ross128b.keh.com/shop/accessories.html",
    "https://ross128b.keh.com/shop/tripods-monopods.html",
    "https://ross128b.keh.com/shop/lighting.html",
    "https://ross128b.keh.com/shop/video.html",
    "https://ross128b.keh.com/shop/more.html"
]

var scrapedUrls = []
const outputFile = 'data.json'
const outputExcel = 'MissingImages.xlsx'
const responsePromises = []
let productsScraped = 0
let pagesScraped = 0
let categoriesFinished = 0

const self = {
    parsedResults: [],
    getWebsiteContent: async (url) => {
        try {
            if (scrapedUrls.includes(url) || url.includes('278')) {
            } else {

                response = await axios.get(url)


                const itemCategory = self.getCategoryFromUrl(url)

                console.log(chalk.cyan(`  Scraping: ${url}`))
                pagesScraped++
                console.log(chalk.red(`  Found ${self.parsedResults.length} items so far`))
                console.log(chalk.green(`  Parsed ${productsScraped} products so far`))


                const $ = cheerio.load(response.data)

                $('.product-item').each(function (i, elm) {
                    productsScraped++
                    var img = $(elm).find('.product-image-container')
                    var name = $(elm).find('.product-item-name').text().trim()
                    var source = img.find('img').attr('data-src')
                    var price = $(elm).find('.price').first().text()
                    var productItemLink = $(elm).find('.product-item-link').attr('href')
                    // sku is currently in the 3rd meta tag with itemprop = sku, content contains the sku
                    var sku = $(elm).find('meta:nth-child(3)').attr('content')

                    var productID = $(elm).find('.price-final_price').attr('data-product-id')


                    var moreID = $(elm).find('.towishlist').attr('data-post')

                    // find product ID for out of stock items
                    if (productID == null) {

                        if (moreID != null) {
                            var startIndex = moreID.indexOf("product\":")
                            var endIndex = moreID.indexOf(",\"uenc")
                            productID = moreID.substring(startIndex + 9, endIndex)
                        }

                    }

                    // broken image URL
                    // https://www.keh.com/media/catalog/product/placeholder/default/placeholder-min_5.png

                    // search for broken image
                    if (source != null && source.includes('placeholder')) {

                        if (price == "") {
                            price = "Out of stock"
                        }

                        // match up with json to pull out classification and sales data
                        var jsonResult = json.filter(a => a.ModelId === sku);

                        var productClass
                        var productQuantity

                        if (!(jsonResult.length == 0)) {
                            productClass = jsonResult[0].Class
                            productQuantity = jsonResult[0].MeasureValues
                        } else {
                            productClass = 'N/A'
                            productQuantity = 'N/A'
                        }

                        const metadata = {
                            productName: name,
                            modelNumber: sku,
                            skuID: productID,
                            productPrice: price,
                            productCategory: itemCategory,
                            productClass: productClass,
                            productQuantity: productQuantity,
                            productItemLink: productItemLink,
                            urlLocated: url
                        }
                        if (!self.parsedResults.includes(metadata)) {
                            self.parsedResults.push(metadata)
                        }

                    }


                })

                // trying to use promise to only export results once everything is finished
                // not working yet
                return new Promise((resolve, reject) => {

                    // Pagination 
                    const nextPageLink = $('#load-more-product-link').attr('href')

                    scrapedUrls.push(url)
                    if (nextPageLink != null && !(nextPageLink.includes('278'))) {
                        self.getWebsiteContent(nextPageLink)
                    } else {
                        console.log(chalk.yellow.bgBlue(`\n ${chalk.underline.bold(itemCategory)} Category Finished\n`))
                        resolve('Category finished')
                        categoriesFinished++

                        // export results when all categories are finished
                        if (categoriesFinished == keplerURLS.length - 1) {
                            self.exportResults(self.parsedResults)
                        }
                    }

                })

            }

        } catch (error) {
            console.log(error)
        }
    },

    exportResults: (parsedResults) => {
        fs.writeFile(outputFile, JSON.stringify(parsedResults, null, 4), (err) => {
            if (err) {
                console.log(err)
            }
            console.log(chalk.yellow.bgBlue(`\n ${chalk.underline.bold(parsedResults.length)} Results exported successfully to ${chalk.underline.bold(outputFile)}\n`))

        })

        // write data to excel file
        // need to figure out how to stop duplicating content

        worksheet.addRows(self.parsedResults)
        workbook.xlsx.writeFile(outputExcel)
        console.log(chalk.yellow.bgBlue(`\n ${chalk.underline.bold(self.parsedResults.length)} Results exported successfully to ${chalk.underline.bold(outputExcel)}\n`))


    },

    getCategoryFromUrl: (url) => {
        if (url.includes("more")) {
            category = "More"
        } else if (url.includes("video")) {
            category = "Video"
        } else if (url.includes("lighting")) {
            category = "Lighting"
        } else if (url.includes("tripods")) {
            category = "Tripod"
        } else if (url.includes("accessories")) {
            category = "Accessories"
        } else if (url.includes("lenses")) {
            category = "Lenses"
        } else if (url.includes("film")) {
            category = "Film Cameras"
        } else if (url.includes("digital")) {
            category = "Digital Cameras"
        } else {
            category = "None found"
        }
        return category
    },
    loopOverURLS: async () => {

        let urls = keplerURLS

        // promise feature still not working for some reason

        const results = await Promise.allSettled(
            urls.map(url => self.getWebsiteContent(url))).then(res => {
                console.log('Finished')

            })

    },
    app: async () => {
        await self.loopOverURLS()
    }
}
module.exports = self

