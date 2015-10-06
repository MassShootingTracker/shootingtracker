

var fs = require('fs');
var Converter = require('csvtojson').Converter;
var converter = new Converter({});

var _ = require('lodash');


converter.on("end_parsed", function (jsonArray) {
   console.log(jsonArray); //here is your result jsonarray

   jsonArray = _.map(jsonArray, function(dat) {

    var location = dat.Location.split(',');

    var city = location[0].trim();
    var state = location[1].trim();

    var sources = [
      dat.Article1,
      dat.Article2,
      dat.Article3,
      dat.Article4,
      dat.Article5
    ];

    sources = _.filter(sources);

    return {
      date: dat.Date,
      name: dat.Shooter,
      killed: dat.Dead,
      wounded: dat.Injured,
      city: city,
      state: state,
      synopsis: '',
      guns_info: '',
      other_info: '',
      sources_csv: sources.join(', ')
    };

   });

   fs.writeFile('../data/2015json.json', JSON.stringify(jsonArray));
});


fs.createReadStream("../data/2015CURRENT.csv").pipe(converter);