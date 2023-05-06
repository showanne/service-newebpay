const express = require('express');
const router = express.Router();
const crypto = require('crypto');

require('dotenv').config();

const orders = {} // 暫存訂單資料
const RespondType = 'JSON'

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: '藍新金流付款' });
});

// 建立訂單
router.post('/createOrder', function(req, res, next) {
  const orderData = req.body // 前端傳過來的訂單資料
  const timeStamp = Math.round(new Date().getTime() / 1000) // 蘭新金流有限制時間戳長度 10 位數
  console.log(orderData, timeStamp);

  // 使用時間戳當作商店訂單編號
  orders[timeStamp] = {
    ...orderData, // 將前端的資料取出來
    timeStamp,
    merchantOrderNo: timeStamp
  }
  console.log('/createOrder', orders);
  res.json(orders[timeStamp]); // 將整筆訂單資料傳給前端
});

// 確認訂單
router.get('/checkOrder', function(req, res, next) {
  res.render('checkOrder', { title: '付款資料確認' });
});
router.get('/getOrder/:id',  function(req, res) {
  const { id } = req.params // 取得附在網址上的訂單編號
  const order = orders[id]
  // const paramsString = genDataChain(order) // 組成藍新金流所需字串
  // console.log(id, paramsString);
  console.log('/getOrder/:id', orders[id]);
  
  const aesEncrypt = create_mpg_aes_encrypt(order) // 交易資料
  console.log('aesEncrypt：', aesEncrypt);
  
  const shaEncrypt = create_mpg_sha_encrypt(aesEncrypt) // 交易驗證用
  console.log('shaEncrypt：', shaEncrypt);

  res.json({
    order, // 將整筆訂單資料傳給前端
    aesEncrypt,
    shaEncrypt
  });
})

router.post('/mpg_gateway_return_url', function(req, res) {
  const data = req.body;
  console.log('/mpg_gateway_return_url', data);
  res.render('return', { title: '付款成功' });
})
router.post('/mpg_gateway_notify_url', function(req, res) {
  const data = req.body;
  console.log('/mpg_gateway_notify_url', data);

  // 將回傳的資料解密
  const info = create_mpg_aes_decrypt(data.TradeInfo)
  console.table(info.Result);
  console.log(info, info.Result.MerchantOrderNo);
  // 取出訂單資料
  console.log(orders[info.Result.MerchantOrderNo]);

  res.end();
})

const data = {
  Status: 'SUCCESS',
  MerchantID: 'MS148719690',
  Version: '1.5',
  TradeInfo:  'c163f94481f7d1fd4e22cc3d4fc3d3958bf62e4e41fbc59e1038c85b4dc93f02745513c0b597815006c4e3170942c8ae98c6932ad666d51cab2846674760374c6f75184c7d9c9424ae86fd6654f7772c6be066341bdd6c85fe4cf4b0853e290fd9adf7e01b49436e454f1f5789db0d270c0a33147e6c195b10f3681f02509539258680e1f44be141920fd1f43e6d89cc14551313dc0c4e93705b71df231f0e1c27e7ba6c32cc34f9d1f835c941ccf85a832e45271d2a21153330cc5c92c03e3081325b2a7c95cd6eb799cfe980a59d8b73004486d38658c339c051cc4ce81e338814a34e6acd2adbccc2ebac7e61b3f75c92be2c4bc9c7c1925d7ebfdd3829d8dcaa92a13214333b084a1f25464388387889b79c446aaeb843a8d3d6b8b1701b0c4a7ca0dabd6034d0dc67d67b53a34e2711e97e8ae21fee48e08cf9ea08cb4a531ec9685d6ca2947feab5daba2f26d4bd6f19425237d3746f30287c78f2cb1f0bed0391851d3b9b372bbfc74d1d89cb959a5a02e2cc36a98d4c681de420e2279c1bb4f6746c8bbf52f7568ea46f1284f4a77bf9ab57682f46d093c02bf8950b',
  TradeSha: 'AFE222073590DB7EEBDF70C2989BD891EAEA1ED802C187AD2087F5E5B78C0EAE'
}


module.exports = router;

// 組成藍新金流所需字串 - 特別注意轉換字串時，ItemDesc、Email 會出現問題，要使用 encode 來轉換成藍新金流要的格式
function genDataChain(order) {
  return `MerchantID=${process.env.Newebpay_MerchantID}&RespondType=${RespondType}&TimeStamp=${order.timeStamp}&Version=${process.env.Newebpay_Version}&MerchantOrderNo=${order.merchantOrderNo}&Amt=${order.amt}&ItemDesc=${encodeURIComponent(order.itemDesc)}&Email=${encodeURIComponent(order.email)}`;
}

// 使用 aes 加密
// $edata1=bin2hex(openssl_encrypt($data1, "AES-256-CBC", $key, OPENSSL_RAW_DATA, $iv));
function create_mpg_aes_encrypt(TradeInfo) {
  const encrypt = crypto.createCipheriv('aes256', process.env.Newebpay_HashKey, process.env.Newebpay_HashIV); // 製作加密資料
  const enc = encrypt.update(genDataChain(TradeInfo), 'utf8', 'hex'); // 將訂單內容加密
  return enc + encrypt.final('hex');
}

// sha256 加密
// $hashs="HashKey=".$key."&".$edata1."&HashIV=".$iv;
function create_mpg_sha_encrypt(aesEncrypt) {
  const sha = crypto.createHash('sha256');
  const plainText = `HashKey=${process.env.Newebpay_HashKey}&${aesEncrypt}&HashIV=${process.env.Newebpay_HashIV}`;

  return sha.update(plainText).digest('hex').toUpperCase();
}

// 將 aes 解密
function create_mpg_aes_decrypt(TradeInfo) {
  const decrypt = crypto.createDecipheriv('aes256', process.env.Newebpay_HashKey, process.env.Newebpay_HashIV);
  decrypt.setAutoPadding(false);
  const text = decrypt.update(TradeInfo, 'hex', 'utf8');
  const plainText = text + decrypt.final('utf8');
  const result = plainText.replace(/[\x00-\x20]+/g, '');
  return JSON.parse(result);
}