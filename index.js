const request = require('postman-request');
const stringify = require('csv-stringify');
const cheerio = require('cheerio');
const fs = require('fs');
const program = require('commander');
const CSV = require('csv-string');

program
  .description('scrape news articles matching a keyword in a given time range \n e.g. \n node index.js --keyword potato --startdate 06-01-2018 --enddate 06-01-2019 --medium wp')
  .option('-k, --keyword <keyword>', 'keyword you are searching for')
  .option('-s, --startdate <startdate>', 'start date')
  .option('-e, --enddate <enddate>', 'end date')
  .option('-m, --medium <medium>', 'medium (wp=washington post, politico');

program.parse(process.argv);
console.log(program.opts());
if (program.keyword) console.log(program.keyword);
if (program.startdate) console.log(program.startdate);
if (program.enddate) console.log(program.enddate);

let keyword = program.keyword;

let start_date = new Date(program.startdate);
let end_date = new Date(program.enddate);

let results_stored = [];

run();



function getOverview(medium,offset,number_of_results){
	if(medium == 'wp')
		return getOverviewWP(offset,number_of_results)
	if(medium == 'politico')
		return getOverviewPolitico(offset,number_of_results)
}

function getOverviewPolitico(offset,number_of_results){
		offset = parseInt(offset)+1;
		let url = `https://www.politico.com/search/${offset}?s=newest&q=${keyword}&adv=true&start=06/01/2018&end=06/01/2019&c=0000016c-7218-df3f-a1fe-779a301e0006`;
       	console.log(url);
       return new Promise(function(resolve, reject) {
               request.get(url, function(error,response,data) {
                   const $ = cheerio.load(data);
                   if(error)
                       reject(error);

                   let results = [];
                   $('.story-frag-list.layout-linear li').each(function(i, elem) {
                   		let pubdatetime = $(this).find('.meta').text().trim();
                   		let category = $(this).find('.category').text().trim();
                   		let title = $(this).find('header h3 a').text().trim();
                   		let link = $(this).find('header h3 a').attr('href').trim();
                   		let systemid = link;
                   		let img = $(this).find('.thumb img').attr('data-lazy-img').trim();
                   		let teaser = $(this).find('.tease').text().trim();
                   		results.push({
                   			systemid,
                   			pubdatetime,
                   			title,
                   			category,
                   			link,
                   			img,
                   			teaser
                   		});
                       	//console.log($(this).text());
                         //fruits[i] = $(this).text();
                        //console.lo
                    });
                   	resolve({documents:results});
               });
       });

}

function getOverviewWP(offset,number_of_results){
	offset = offset*number_of_results;

	if(typeof offset == 'undefined'){
		offset = 0;
	}
	if(typeof number_of_results == 'undefined'){
		number_of_results = 20;
	}

	// crawl all articles since 2005 =>	let url = `https://sitesearchapp.washingtonpost.com/sitesearch-api/v2/search.json?count=${number_of_results}&datefilter=displaydatetime:%5B*+TO+NOW%2FDAY%2B1DAY%5D&facets.fields=%7B!ex%3Dinclude%7Dcontenttype,%7B!ex%3Dinclude%7Dname&highlight.fields=headline,body&highlight.on=true&highlight.snippets=1&query=${keyword}&sort=displaydatetime+desc&startat=${offset}`;
	let crawlingperiod = '3YEARS+TO+NOW';
	let url = `https://sitesearchapp.washingtonpost.com/sitesearch-api/v2/search.json?count=${number_of_results}&datefilter=displaydatetime:%5BNOW%2FDAY-${crawlingperiod}%2FDAY%2B1DAY%5D&facets.fields=%7B!ex%3Dinclude%7Dcontenttype,%7B!ex%3Dinclude%7Dname&highlight.fields=headline,body&highlight.on=true&filter=%7B!tag%3Dinclude%7Dcontenttype:("Article")&highlight.snippets=1&query=${keyword}&sort=displaydatetime+desc&startat=${offset}`;

	console.log(url);
	return new Promise(function(resolve, reject) {
		request(url, function (error, response, body) {
			if(error)
				reject(error)
		 	let result = JSON.parse(body);
		 	resolve({documents:result.results.documents})
		});
	});
}

function storeHeader(medium, writeStream){
	let new_line = [];
	let field_array;
	if(medium == 'wp'){
		field_array = ['systemid','contenttype','contenturl','headline','mobileheadline','sourcenav','byline','pubdatetime','pubdatetimestring','displaydatetime','primarysection','blurb','keyword','smallthumburl'];
	}else if(medium == 'politico'){
		field_array = ['systemid','link','date','title','category','teaser','img'];
	}

	for(let i in field_array){
		new_line.push(field_array[i]);
	}
    writeStream.write(new_line.join(',')+ '\n', () => {
        // a line was written to stream
    })
}

function storeResult(medium,writeStream, result){
	let field_array;
	if(medium == 'wp'){
		field_array = ['systemid','contenttype','contenturl','headline','mobileheadline','sourcenav','byline','pubdatetime','pubdatetimestring','displaydatetime','primarysection','blurb','keyword','smallthumburl'];
	}else if(medium == 'politico'){
		field_array = ['systemid','link','date','title','category','teaser','img'];
	}

	console.log(result.contenttype,results_stored.indexOf(result.systemid));
	if(results_stored.indexOf(result.systemid)>-1){
		console.log('double', results_stored.indexOf(result.systemid));
		console.log(result.systemid);
		return false
	}
	else
		results_stored.push(result.systemid);

	let new_line = [];
	for(let i in field_array){
		if(typeof result[field_array[i]] == 'string'){
			result[field_array[i]] = result[field_array[i]].replace(/(?:\r\n|\r|\n)/g, '<br>');
			
			//let field = result[field_array[i]];

			//if(result[field_array[i]].indexOf(',') > -1)
				//die();
		}

		if(result[field_array[i]])
			new_line.push(result[field_array[i]]);
		else
			new_line.push('');
	}
	console.log(new_line.join(','));


	return new Promise(function(resolve, reject) {	
	    writeStream.write(CSV.stringify(new_line), () => {
	        // a line was written to stream
	        resolve();
	    })
	});
}

function run(){
	(async function loop() {

		let start_offset = 0;
		let number_of_results=1000;
		let max_iterations = 1000;


		let medium = program.medium;
		let results = [];


		console.log('medium',medium);


		//open writestream
		let writeStream = fs.createWriteStream(medium+'-'+keyword+'.csv');
		storeHeader(medium,writeStream);

	    for (let i = start_offset; i < max_iterations; i++) {
	    	console.log('max_iterations',max_iterations);
	        let result = await getOverview(medium,i, number_of_results);
	        if(i == start_offset){
		        //storeHeader(writeStream,result.documents[0]);

				//max_iterations = result.total/number_of_results;
	        }
	        //console.log('result');
	        //console.log(result);
	        if(result.documents&&result.documents.length>0){




				for(let n in result.documents){
					let document_date = new Date(result.documents[n].pubdatetime);

					if(+document_date >= +start_date&&+document_date <= +end_date){
						console.log('hit');
						console.log(document_date);
						if(result.documents[n]){

							//delete result.documents[i].keyword;
							result.documents[n].pubdatetimestring = document_date;
							//console.log(result.documents[i]);
							if(typeof result.documents[n].keyword == 'object')
								result.documents[n].keyword = result.documents[i].keyword.join(',');
							//console.log(result.documents[i]);
							//await csvWriter.writeRecords(result.documents[i])
							console.log('store result '+result.documents[n].systemid);
							await storeResult(medium, writeStream,result.documents[n]);
							//results.push(result.documents[i]);
							//fs.writeFileSync('out_file.csv', csv);
						}
						
					}

				}

	        }
			

		

	        console.log(i);
	    }

	    //close writestream

	    writeStream.end();

		writeStream.on('finish', () => {
		    console.log('finish write stream')
		}).on('error', (err) => {
		    console.log(err)
		})


	})();
}