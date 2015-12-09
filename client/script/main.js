'use strict';

var _ = require('lodash');
var moment = require('moment');

var months = ['Jan', 'Feb', 'Mar', 'April', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

var killedMonthSeries = _.map(months, function(month) {
  return {
    name: month,
    drilldown: 'killed-' + month,
    y: 0
  };
});

var woundedMonthSeries = _.map(months, function(month) {
  return {
    name: month,
    drilldown: 'wounded-' + month,
    y: 0
  };
});

var woundedDrilldownSeries = _.map(months, function(month) {
  return {
    name: 'Wounded',
    id: 'wounded-' + month,
    data: [],
  };
});

var killedDrilldownSeries = _.map(months, function(month) {
  return {
    name: 'Killed',
    id: 'killed-' + month,
    data: [],
  };
});

function initChart() {

  var $chartContainer = $('#mst-chart');

  if (!$chartContainer) {
    return;
  }

  _.forEach(window.data, function(shooting) {
    var date = moment(shooting.date);
    var month = date.month();
    killedMonthSeries[month].y += shooting.killed;
    woundedMonthSeries[month].y += shooting.wounded;

    woundedDrilldownSeries[month].data.unshift([shooting.displayDate, shooting.wounded]);
    killedDrilldownSeries[month].data.unshift([shooting.displayDate, shooting.killed]);
  });

  $chartContainer.highcharts({
        chart: {
            type: 'column'
        },
        colors: ['#c4c4c4', '#d9534f'],
        title: {
            text: 'U.S. Mass Shootings, ' + window.year
        },
        subtitle: {
            text: 'Click the columns to drill down.'
        },
        xAxis: {
            type: 'category'
        },
        yAxis: {
            title: {
                text: 'Number killed and wounded'
            }

        },
        labels: {
          style: {
            'text-shadow': 'none'
          }
        },
        legend: {
            enabled: true
        },
        plotOptions: {
            column: {
                stacking: 'normal'
            },
            series: {
                borderWidth: 0,

                dataLabels: {
                    enabled: true,
                    style: {
                      textShadow: 'none'
                    }
                }
            }
        },

        tooltip: {
            headerFormat: '<span style="font-size:11px">{series.name}</span><br>',
            pointFormat: '<span style="color:{point.color}">{point.name}</span>: <b>{point.y}</b> <br/> <span>{point.location}</span> <br/>'
        },

        series: [
          {
              name: "Wounded",
              data: woundedMonthSeries
          },
          {
              name: "Killed",
              data: killedMonthSeries
          }
        ],
        drilldown: {
            allowPointDrilldown: false,
            series: woundedDrilldownSeries.concat(killedDrilldownSeries)
        }
    });
}

$(initChart);