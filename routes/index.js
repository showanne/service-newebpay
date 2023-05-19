const express = require('express');
const router = express.Router();
const Order = require('../model/orderModels');

const {
  createOrder,
  getOrder,
  mpg_return,
  getReturn,
  mpg_notify
} = require('../controllers/index.js');

console.log('createOrder', createOrder);
require('dotenv').config();

const orders = {} // 暫存訂單資料
const RespondType = 'JSON'

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: '藍新金流付款' });
});

// 建立訂單
router.post('/createOrder', createOrder);

// 確認訂單
router.get('/checkOrder', function(req, res, next) {
  res.render('checkOrder', { title: '付款資料確認' });
});
router.get('/getOrder/:id', getOrder)

// 藍新金流通知交易資訊，前端顯示交易有成功
router.post('/mpg_gateway_return_url', mpg_return)
router.get('/return/', getReturn)

// 藍新金流通知付款完成 /?回傳進資料庫
router.post('/mpg_gateway_notify_url', mpg_notify)

module.exports = router;