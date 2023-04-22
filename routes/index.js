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