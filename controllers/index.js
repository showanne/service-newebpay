const crypto = require('crypto');
const Order = require('../model/orderModels');

// const orders = {} // 暫存訂單資料
const RespondType = 'JSON'

// createOrder 建立訂單 - POST /createOrder
async function createOrder (req, res, next) {
  const orderData = req.body // 前端傳過來的訂單資料
  const timeStamp = Math.round(new Date().getTime() / 1000) // 蘭新金流有限制時間戳長度 10 位數
  console.log(orderData, timeStamp);

  try {
    const newOrder = await Order.create({
      user_name: orderData.name,
      user_email: orderData.email,
      project: orderData.itemDesc,
      order_id: timeStamp, // 使用時間戳當作商店訂單編號
      payment_price: orderData.amt,
      // payment_method: 'WebATM'
    })
    console.log(newOrder);
    res.status(200).send({
      success: true,
      message: '建立訂單成功',
      newOrder
    })
  } catch (error) {
    console.error(error.message);
    // if (error instanceof MongoServerError) {} // 關鍵字判斷錯誤物件是否為 MongoServerError
    res.status(400).send({
      success: true,
      message: error.message
    })
  }
  
  // orders[timeStamp] = {
  //   ...orderData, // 將前端的資料取出來
  //   timeStamp,
  //   merchantOrderNo: timeStamp
  // }
  // console.log('/createOrder', orders);
  // res.json(orders[timeStamp]); // 將整筆訂單資料傳給前端
}

// getOrder 確認訂單 - GET /getOrder/:id
async function getOrder (req, res) {
  const { id } = req.params // 取得附在網址上的訂單編號
  const order = await Order.find({ order_id: id })
  // const paramsString = genDataChain(order) // 組成藍新金流所需字串
  // console.log(id, paramsString);
  // console.log('/getOrder/:id', order);
  
  const aesEncrypt = create_mpg_aes_encrypt(order) // 交易資料
  console.log('aesEncrypt：', aesEncrypt);
  
  const shaEncrypt = create_mpg_sha_encrypt(aesEncrypt) // 交易驗證用
  console.log('shaEncrypt：', shaEncrypt);

  const checkOrder = await Order.findOneAndUpdate(
    { order_id: id },
    {
      $set: {
        newebpay_aes_encrypt: aesEncrypt,
        newebpay_sha_encrypt: shaEncrypt,
      },
    },
    { new: true }
  );

  console.log('order: ', checkOrder);

  try {
    console.log(order);
    res.status(200).send({
      success: true,
      message: '取得訂單資料',
      checkOrder
    })
  } catch (error) {
    res.status(400).send({
      success: true,
      message: error.message
    })
  }
  
  // res.json({
  //   order, // 將整筆訂單資料傳給前端
  //   aesEncrypt,
  //   shaEncrypt
  // });
}

// mpg_gateway_return_url 藍新金流通知交易資訊 - 藍新以POST mpg_return
async function mpg_return (req, res) {
  const data = req.body;
  console.log('/mpg_gateway_return_url', data);

  // 將回傳的資料解密
  const info = create_mpg_aes_decrypt(data.TradeInfo)
  // console.table('/mpg_gateway_return_url', info.Result);

  let payment_status = 0
  if (info.Status == 'SUCCESS') {
    payment_status = 1 // 待付款
  } else {
    payment_status = 2 // 付款失敗
  }

  // 取出訂單資料，將交易結果傳進資料庫
  // console.log(orders[info.Result.MerchantOrderNo]);
  const order = await Order.findOneAndUpdate(
    { order_id: info.Result.MerchantOrderNo },
    {
      $set: {
        payment_status: payment_status, // 更新付款狀態
        order_status: 1 // 更新訂單狀態為 1-處理中
      },
    },
    { new: true }
  );
  // orders[info.Result.MerchantOrderNo].payment_status = info.Status

  console.log('Order Return', order);

  try {
    console.log('success', order);
    res.status(200).send({
      success: true,
      message: '取得交易結果',
      order
    })
  } catch (error) {
    res.status(400).send({
      success: true,
      message: error.message
    })
  }

  res.render('return', {
    title: info.Message
    // formData: order
  });
  // res.json(orders[info.Result.MerchantOrderNo]); // 將整筆訂單資料傳給前端
}

// mpg_gateway_notify_url 藍新金流通知付款完成 - POST mpg_notify
async function mpg_notify (req, res) {
  const data = req.body;
  console.log('/mpg_gateway_notify_url', data);

  // 將回傳的資料解密
  const info = create_mpg_aes_decrypt(data.TradeInfo)
  console.table('/mpg_gateway_notify_url', info.Result);
  console.log(info, info.Result.MerchantOrderNo);

  let payment_status = 0
  let order_status = 0
  if (info.Status == 'SUCCESS') {
    payment_status = 2 // 付款完成
    order_status = 2 // 已完成
  } else {
    payment_status = 1 // 待付款
    order_status = 1 // 處理中
  }

  // 取出訂單資料
  // console.log(orders[info.Result.MerchantOrderNo]);
  const order = await Order.findOneAndUpdate(
    { order_id: info.Result.MerchantOrderNo },
    {
      $set: {
        payment_status: payment_status, // 更新付款狀態
        order_status: order_status, // 更新訂單狀態
      },
    },
    { new: true }
  );

  console.log('Order Notify', order);

  res.end();
}


// 組成藍新金流所需字串 - 特別注意轉換字串時，ItemDesc、Email 會出現問題，要使用 encode 來轉換成藍新金流要的格式
function genDataChain(order) {
  // console.log('genDataChain(order):', order[0]);
  const orderData = `MerchantID=${process.env.Newebpay_MerchantID}&RespondType=${RespondType}&TimeStamp=${order[0].order_id}&Version=${process.env.Newebpay_Version}&MerchantOrderNo=${order[0].order_id}&Amt=${order[0].payment_price}&ItemDesc=${encodeURIComponent(order[0].project)}&Email=${encodeURIComponent(order[0].user_email)}`
  // console.log('genDataChain:', orderData);
  return orderData;
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

module.exports = {
  createOrder,
  getOrder,
  mpg_return,
  mpg_notify
};