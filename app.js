require('dotenv').load();
const Gdax = require('gdax');
const key = process.env.GDAX_KEY; 
const b64secret = process.env.GDAX_SECRET; 
const passphrase = process.env.GDAX_PASS; 
const apiURI = 'https://api.gdax.com';
const sandboxURI = 'https://api-public.sandbox.gdax.com';
const minTimes = 20;
const authedClient = new Gdax.AuthenticatedClient(key, b64secret, passphrase, apiURI);

const publicClient = new Gdax.PublicClient();
const websocket = new Gdax.WebsocketClient(['BTC-USD', 'ETH-USD', 'LTC-USD']);
var defaults = new Array();
 defaults['BTC-USD'] = { currency: 'BTC', sell_change: '.09', buy_change: '.1', start_amt: 12000, buy_amt: 50, sell_amt: 50, last_purchased: 15459, last_sold: 15779, min_val: 14000, doing_transaction: false };
 defaults['ETH-USD'] = { currency: 'ETH', sell_change: '.09', buy_change: '.09', start_amt: 450, buy_amt: 50, sell_amt: 50, last_purchased: 450, last_sold: 422, min_val: 400, doing_transaction: false  };
 defaults['LTC-USD'] = { currency: 'LTC', sell_change: '.09', buy_change: '.09', start_amt: 110, buy_amt: 50, sell_amt: 50, last_purchased: 175, last_sold: 150, min_val: 110, doing_transaction: false  };
var averages = new Array();
 averages['BTC-USD'] = { count: 0, price: 0 };
 averages['ETH-USD'] = { count: 0, price: 0 };
 averages['LTC-USD'] = { count: 0, price: 0 };
var trending = new Array();
 trending['BTC-USD'] = { up: 0, down: 0, price: 0 };
 trending['ETH-USD'] = { up: 0, down: 0, price: 0 };
 trending['LTC-USD'] = { up: 0, down: 0, price: 0 };
var currency_accounts = new Array(); 

 
getAccounts(function(accounts){
	getAccountOrders(function(orderdata){
		websocket.on('message', data => { 
			// work with data 		

			analyzeData(data,accounts,orderdata);
			
		});  
	});
});
websocket.on('error', err => { /* handle error */ console.log(err); });
websocket.on('close', () => { /* ... */ console.log('connection closed'); }); 


function analyzeData(feeddata,accounts,orderdata)
{
	let local_obj = {};
	local_obj.accounts = accounts;
	//let priceobj = [];
	//getAccounts(function(accounts){
		//getAccountOrders(function(orderdata)
		//{ 
			/* console.log('****************************************************************');
			console.log(orderdata);
			console.log('$$$$$****************************************************************'); */
			//console.log(feeddata);
			//console.log(defaults);
		//console.log(accounts['USD']);	
			if(feeddata.price > 0 && feeddata.price > 1){
				//make sure price occurs more than min times
				if(averages[feeddata.product_id].price == feeddata.price)
				{
					averages[feeddata.product_id].count += 1;
				}
				else{
					averages[feeddata.product_id].count = 0;
				}
				averages[feeddata.product_id].price = feeddata.price;
				//console.log(defaults[feeddata.product_id].doing_transaction);
				let deciding_price = defaults[feeddata.product_id].last_purchased;
				if(defaults[feeddata.product_id].last_purchased < defaults[feeddata.product_id].last_sold)
					deciding_price = defaults[feeddata.product_id].last_sold;
				let sell_price = parseFloat(parseFloat(deciding_price) + parseFloat(deciding_price * defaults[feeddata.product_id].sell_change));
				let buy_price = parseFloat(deciding_price - parseFloat(deciding_price * defaults[feeddata.product_id].buy_change));
				
				//console.log(feeddata.product_id+' - '+defaults[feeddata.product_id].last_purchased+' '+deciding_price+' '+sell_price+' '+buy_price);
				//console.log('sell '+sell_price+' buy '+buy_price+' price '+feeddata.price + ' '+feeddata.settled+' '+feeddata.side);
				//feeddata.settled && side not populated enough
				
				if(/* feeddata.side=='sell'  &&*/ feeddata.price > sell_price && averages[feeddata.product_id].count > minTimes && !defaults[feeddata.product_id].doing_transaction /* && feeddata.reason!='canceled' */){
					//sell
					//console.log(feeddata.product_id+' - '+defaults[feeddata.product_id].last_purchased+' '+deciding_price+' '+sell_price+' '+buy_price);
					console.log('sell '+feeddata.product_id+' for '+feeddata.price);
					console.log(currency_accounts[defaults[feeddata.product_id].currency]);
					//console.log(accounts);
					if(feeddata.price >= trending[feeddata.product_id]){
						trending[feeddata.product_id].up += 1;
					}
					else{
						trending[feeddata.product_id].down += 1;
					}
					console.log(defaults[feeddata.product_id].doing_transaction);
					trending[feeddata.product_id].price = feeddata.price;
					defaults[feeddata.product_id].doing_transaction = true;
					transactCoin(feeddata.product_id, feeddata.price, 'sell', accounts, (data) => { defaults[feeddata.product_id].doing_transaction = false;  /*accounts = data;/* console.log(data); */ });
				}
				if(/* feeddata.side=='sell' &&*/ feeddata.price < buy_price && averages[feeddata.product_id].count > minTimes && !defaults[feeddata.product_id].doing_transaction /* && feeddata.reason!='canceled' */){
					//buy
					//console.log(feeddata.product_id+' - '+defaults[feeddata.product_id].last_purchased+' '+deciding_price+' '+sell_price+' '+buy_price);
					console.log('buy '+feeddata.product_id+' for '+feeddata.price);
					console.log(currency_accounts[defaults[feeddata.product_id].currency]);
					//console.log(accounts);
					console.log(defaults[feeddata.product_id].doing_transaction);
					defaults[feeddata.product_id].doing_transaction = true;
					transactCoin(feeddata.product_id, feeddata.price, 'buy', accounts, (data) => { defaults[feeddata.product_id].doing_transaction = false; /*accounts = data;/* console.log(data); */ });
				}
				//defaults[feeddata.product_id].doing_transaction = true;
			}
		//});	
	//});
}

//api functions


//get account info
function getAccounts(cb){
	authedClient.getAccounts(function(err, response, data){			
		let accts = data; 
		let accounts_obj = [];
		let cnt = 0;
		for(var key in accts){
			//console.log(key + ":" + accts[key]);
			let acct = accts[key];		
			let acct_no = acct.id;
			let acct_bal = acct.balance;
			let profile_id = acct.profile_id;
			if(currency_accounts[acct.currency])
				cnt = currency_accounts[acct.currency].cnt+1
			accounts_obj[acct.currency] = { 'number':acct_no, 'balance':acct_bal };
			currency_accounts[acct.currency] = { 'cnt': cnt, 'number':acct_no, 'balance':acct_bal };
		}	
		//accounts = Object.assign({}, accounts_obj);				
		cb = cb || null;
		if(cb)
			cb(accounts_obj);		
	});  
}

function getAccounts2(cb){
	authedClient.getAccounts(function(err, response, data){			
		let accts = data; 
		let accounts_obj = [];
		for(var key in accts){
			//console.log(key + ":" + accts[key]);
			let acct = accts[key];		
			let acct_no = acct.id;
			let acct_bal = acct.balance;
			let profile_id = acct.profile_id;
			accounts_obj[acct.currency] = { 'aaaaaaaaa':0, 'number':acct_no, 'balance':acct_bal };
			
			currency_accounts[acct.currency] = { 'aaaaaaaaa':0, 'number':acct_no, 'balance':acct_bal };			
		}	
		//accounts[acct.currency] = Object.assign({}, accounts_obj[acct.currency]);		
		cb = cb || null;
		if(cb)
			cb(accounts_obj);		
	});  
}

/* getAccounts(function(accounts){
	console.log(accounts['USD']);
	console.log(accounts['LTC']);
	console.log(accounts['ETH']);
	console.log(accounts['BTC']); 
}); */  

/* const coinParams = {
	  'price': '94', // USD
	  'size': '0.006',  // BTC
	  'product_id': 'BTC-USD',
	};
	
 authedClient.sell(coinParams, function(err, data){ 
						if(err){
							console.log(err);
						}
						else{
							//update last_purchased
							
							console.log(data);
						}
					}); 
 */
					
//buy/sell function 
//current price - product - amount
//get size by getting current price then ->  amt to buy / price
function transactCoin(product_id, price, type, accounts, cb){
	//const size = defaults[product_id].buy_amt / price;
	const coinParams = {
	  'price': price, // USD
	  'size': 0,
	  'product_id': product_id //'BTC-USD',
	};	
	defaults[product_id].doing_transaction = true;
	//console.log('sell '+product_id+' for '+price+'size '+accounts[defaults[product_id].currency].balance);
	var self = this;
	//self.accounts = accounts;
	//accounts[defaults[product_id].currency].balance -= 1;
	
	if(price > 0){
		cb = cb || null;
		if(type=='buy')
		{
			//console.log(currency_accounts[defaults[product_id].currency]);
			//accounts = Object.assign({}, coinParams);
			//accounts[defaults[product_id].currency].balance =  'aaaaaaaaaaaaaa';
			getAccounts(function(data){ return cb(data); });
			let buy_amt = defaults[product_id].buy_amt;
			if(accounts['USD'].balance < buy_amt)
				buy_amt = accounts['USD'].balance;
			
			if(buy_amt >= 0 )
			{
				let size = buy_amt / price;
				size = parseFloat(size);
				size = size.toFixed(8);
				//console.log('buy '+product_id+' for '+price);
				if(size > .001)
				{
					coinParams.size = size;
					console.log(type);
					console.log(coinParams);
					 /* authedClient.buy(coinParams, function(err, data){ 
						if(err){
							console.log(err);
						}
						else{
							console.log(data.body);
							//update last_purchased
							defaults[product_id].last_purchased = price;
							accounts['USD'].balance -= buy_amt;
							if(cb)
								cb(data);
						}
					});  */
					//defaults[product_id].last_purchased = price;
					//accounts['USD'].balance -= buy_amt;
					getAccounts(function(data){ cb(data); });
					
				}
			}
					if(cb)
						cb();
		}
		else if(type=='sell')
		{
			//console.log(currency_accounts[defaults[product_id].currency]);
			//accounts[defaults[product_id].currency].balance =  'aaaaaaaaaaaaaa';
			getAccounts(function(data){ return cb(data); });
			let sell_amt = defaults[product_id].sell_amt;			
			if(sell_amt > 0 && price > defaults[product_id].min_val)
			{
				
				let size = sell_amt / price;
				if(accounts[defaults[product_id].currency].balance < size)
					size = accounts[defaults[product_id].currency].balance;
				size = parseFloat(size);
				size = size.toFixed(8);
				//console.log('sell '+product_id+' for '+price+'size'+size);
				sell_amt = parseFloat(size) * parseFloat(price);
				if(size >= .001)
				{
					coinParams.size = size;
					console.log(type);
	console.log(coinParams);
					/*  authedClient.sell(coinParams, function(err, data){ 
						if(err){
							console.log(err);
						}
						else{
							console.log(data.body);
							//update last_sold
							defaults[product_id].last_sold = price;
							accounts[defaults[product_id].currency].balance += sell_amt;
							if(cb)
								cb(data);
						}
					});  */
					//defaults[product_id].last_sold = price;
					//accounts[defaults[product_id].currency].balance += sell_amt;
					getAccounts(function(data){ cb(data); });
				}
			}
					if(cb)
						cb();
		}	
	}
}


//get orders
function getAccountOrders(cb)
{	
	authedClient.getFills(function(err, response, data){		
		 var fills = data; 
		fills.sort(function(a,b){		  
		  return new Date(b.created_at) - new Date(a.created_at);
		});
		
			let prices = [];
			prices['BTC-USD'] = { last_purchased: 0, last_sold: 0  };
			prices['ETH-USD'] = { last_purchased: 0, last_sold: 0  };
			prices['LTC-USD'] = { last_purchased: 0, last_sold: 0  };
			
			for(var key in fills){				
				let row = fills[key];				
				if(row.price > 0 && row.side=='buy' && prices[row.product_id].last_purchased==0)
				{
					prices[row.product_id].last_purchased = row.price;
					defaults[row.product_id].last_purchased = row.price;
				}
				if(row.price > 0 && row.side=='sell' && prices[row.product_id].last_sold==0)
				{
					prices[row.product_id].last_sold = row.price;
					defaults[row.product_id].last_sold = row.price;
				}
			}
			cb = cb || null;
			if(cb)
				cb(fills);   
				
	});
}






/*  not currently used
function getAccountHistory(type, cb)
{	
	getAccounts(function(accounts){
		//console.log(accounts[type].number);
		var acct_id = accounts[type].number;
		authedClient.getAccountHistory(acct_id, function(err, data){
			console.log(data.body);
			var hist = JSON.parse(data.body);
			for(var key in hist){
				//console.log(key + ":" + hist[key]);
				let row = hist[key];
				console.log(row);
			}
			cb = cb || null;
			if(cb)
				cb(accounts);
		});  		
	});
}

getAccountHistory('LTC', function(data){
	
}); */