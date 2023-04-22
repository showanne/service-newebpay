const express = require('express');
const router = express.Router();
require('dotenv').config90

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
    MerchantOrderNo: timeStamp
  }
  console.log('/createOrder', orders);
  res.json();
});

module.exports = router;
