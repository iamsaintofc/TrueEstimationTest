/** Та же палитра, что в index.html. Классы в script.js тоже сканируются. */
module.exports = {
  content: ['./index.html', './script.js'],
  theme: {
    extend: {
      colors: {
        gray: { 50:'#effcff',100:'#d9f3f8',200:'#b9dde4',300:'#9cc5ce',400:'#7aa3ad',500:'#587a84',600:'#33565f',700:'#1b3b43',800:'#0b2a31',900:'#04171c',950:'#020d10' },
        yellow: { 400:'#a5f3fc', 500:'#67e8f9' }
      }
    }
  }
};
