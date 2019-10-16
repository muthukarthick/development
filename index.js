const cheerio = require("cheerio");
const request = require("request");
const express = require("express");
const app = express();

app.get('/', (req, res) => {
    var arrSubCatList = [];
    var arrResult = [];
    var url = "https://www.zara.com/th/en/woman-l1000.html";

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

                            if(subNavUrl != "" && subNavUrl != undefined && subNavTitle != "" && subNavTitle != undefined && index < 6){
                                arrSubCatList.push({
                                    'navTitle': subNavTitle,
                                    'navURL': subNavUrl
                                });
                            }
                            else{
                                return true;
                            }
                        });
                        await resolve(arrSubCatList);
                    }
                }
            });
        });
    });

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
                            if(productUrl && index < intLimit){
                                arrResult.push({
                                    'navTitle': data.navTitle,
                                    'productURL': productUrl
                                });
                            }
                            else{
                                return true;
                            }
                        });
                        await resolve(arrResult);
                    }
                }
            });
        });
    });

    var getSubMenuList = getSubMenu();
    getSubMenuList.then((data) => {

        //Get Product List
        var getProductListDetails = async function(data) {
            try {
                var productResult = await Promise.all(data.map(getProductListing));
            } catch (err) {
                console.error("Product List Fetch Error : " + err);
            }
        };

        //Call Function
        getProductListDetails(data);

    }).catch((error) => {
        console.log("Sub Menu Error : " + error);
    });
});

app.listen(8081, () => {
    console.log("Server Running http://localhost:8081/");
});