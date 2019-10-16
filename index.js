const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const request = require("request");
const express = require("express");
const execTime = require('execution-time')();
const app = express();
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvWriter = createCsvWriter({
  path: 'data.csv',
  header: [
    {id: 'SKU', title: 'SKU'},
    {id: 'productName', title: 'Product Name'},
    {id: 'productUrl', title: 'Product URL'},
    {id: 'price', title: 'Price'},
    {id: 'images', title: 'Images'},
    {id: 'navCategories', title: 'Navigation Categories'},
    {id: 'color', title: 'Product Color'},
    {id: 'executionTime', title: 'Execution Time (Milliseconds)'},
    {id: 'totalExecutionTime', title: 'Total Execution Time (Milliseconds)'}
  ]
});

// Fetch Records Limit
//const intLimit = 2; 

//Template View Engine
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    var arrSubCatList = [];
    var arrResult = [];
    var url = "https://www.zara.com/th/en/woman-l1000.html";

    //Get Womens under all sub menus and links
    var getSubMenu = (async() => {
        return await new Promise(async(resolve, reject) => {
            await request.get(url, async(err, resp, body) => {
                if (err) {
                    await reject(err);
                } else {
                    var $ = await cheerio.load(body);

                    //Get WOMEN Menu List Element
                    var eleLi = $("ul.category-menu").find("[data-name='WOMAN']");

                    if($(eleLi).find('ul.subcategory-menu--level-1  > li.menu-item--level-2').length > 0){
                        $(eleLi).find('ul.subcategory-menu--level-1 > li.menu-item--level-2').each((index, elem) => {
                            var subNavUrl = ($(elem).find('a')) ? $(elem).find('a').attr("href") : "";
                            var subNavTitle = ($(elem).find('a > :nth-child(1)').eq(0)) ? $(elem).find('a > :nth-child(1)').eq(0).text() : "";

                            if(subNavUrl != "" && subNavUrl != undefined && subNavTitle != "" && subNavTitle != undefined /*&& index < 2*/){
                                arrSubCatList.push({
                                    'navTitle': subNavTitle,
                                    'navURL': subNavUrl
                                });
                            }
                        });
                        await resolve(arrSubCatList);
                    }
                }
            });
        });
    });

    //Get each sub menu links based product listing name & url's 
    var getProductListing = (async(data) => {
        return await new Promise(async(resolve, reject) => {
            await request.get(data.navURL, async(err, resp, body) => {
                if (err) {
                    await reject(err);
                } else {
                    var $ = await cheerio.load(body);
                    if($('#products').find('.product').length > 0){
                        $('#products').find('.product').each((index, elem) => {
                            var productUrl = $(elem).find('a').attr("href");
                            if(productUrl /*&& index < intLimit*/){
                                arrResult.push({
                                    'navTitle': data.navTitle,
                                    'productURL': productUrl
                                });
                            }
                        });
                        await resolve(arrResult);
                    }
                }
            });
        });
    });

    //Get each product details data
    var getProductDetail = (async(data) => {
        //Start execution time of this product data fetch
        execTime.start('detail');
        var findPriceText = "THB";
        return await new Promise(async(resolve, reject) => {
            await puppeteer
            .launch()
            .then(async(browser) => await browser.newPage())
            .then(async(page) => {
                await page.goto(data.productURL, {timeout: 0, waitUntil: 'networkidle0'});
                await page.waitForSelector('img');
                try {
                    await page.waitForFunction(
                      findPriceText => document.querySelector('body').innerText.includes(findPriceText),
                      {},
                      findPriceText
                    );
                  } catch(e) {
                    console.log(`The price was not found on the page`);
                  }
                return await page.content();
            })
            .then(async(html) => {
                var $ = await cheerio.load(html);
                var arrData = [];
                var productSKU = ($('#main').find('.product-color > :nth-child(2)')) ? $('#main').find('.product-color > :nth-child(2)').text() : "-";
                var productName = ($('#main').find('.product-name')) ? $('#main').find('.product-name').clone().children().remove().end().text() : "-";
                var price = ($('#product').find('.price')) ? $('#product').find('.price').text() : "-";
                var color = ($('#main').find('.product-color > span._colorName')) ? $('#main').find('.product-color > span._colorName').text() : "-";
                var arrProductImages = [];
                if($('#main').find('#main-images > .image-wrap').length > 0){
                    $('#main').find('#main-images > .image-wrap').each((index, elem) => {
                        var productImageUrl = ($(elem).find('a')) ? $(elem).find('a').attr('href') : "";
                        if(productImageUrl != "" && index < 3){
                            if(productImageUrl[0] === '/'){
                                productImageUrl = 'https:' + productImageUrl;
                            }
                            arrProductImages.push(productImageUrl);
                        }
                        else{
                            return true;
                        }
                    });
                }

                //Stop execution time of this product data fetch
                var timer = execTime.stop('detail').time;

                //return data
                arrData.push({
                    'SKU': productSKU,
                    'productName': productName,
                    'productUrl': data.productURL,
                    'price': price,
                    'color': color,
                    'images': arrProductImages,
                    'navCategories': data.navTitle,
                    'executionTime': timer,
                    'totalExecutionTime': 0
                });
                await resolve(arrData);
            }).catch(async(error) => {
                await reject(error);
            });
        });
    });

    //call subment function
    var getSubMenuList = getSubMenu();
    getSubMenuList.then(async(data) => {
        //Get Product List
        var getProductListDetails = async function(data) {
            try {
                var productResult = await Promise.all(data.map(getProductListing));
            } catch (err) {
                console.error("Product List Fetch Error : " + err);
            }
            //Get Product Details
            var getDetailResult = async function(data) {
                try {
                    var result = await Promise.all(data.map(getProductDetail));
                } catch (err) {
                    console.error(err);
                }
                //Multidiamensional array to single array and remove duplicate
                result = result.flat(1);
                result = Array.from(new Set(result)); 

                //Get total execution time
                var totalExecTime = result.reduce(function(intPrev, objCur) {
                    return parseFloat(intPrev) + parseFloat(objCur.executionTime);
                }, 0);
                //Update total execution time value in each array
                result = result.map((item, index) => {
                    item.totalExecutionTime = totalExecTime;
                    return item;
                });
                //CSV Write
                csvWriter
                .writeRecords(result)
                .then(()=> console.log('The CSV file was written successfully'))
                .catch((err) => console.log("Error : " + err));
                //Render Page
                res.render('index', {data: result});
            };
            //Convert 2D array Format and remove duplicate
            productResult = productResult.flat(1);
            productResult = Array.from(new Set(productResult));
            //Call Function
            await getDetailResult(productResult);
        };
        //Call Function
        await getProductListDetails(data);
    }).catch((error) => {
        console.log("Sub Menu Error : " + error);
    });
});

app.listen(8081, () => {
    console.log("Server Running http://localhost:8081/");
});