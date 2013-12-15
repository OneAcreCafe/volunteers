function renderShiftsCalendar() {
    var day = d3.time.format( '%-d' ),
        weekday = d3.time.format( '%w' ),
        week = d3.time.format( '%U' ),
        hour = d3.time.format( '%H' ),
        month = d3.time.format( '%B' ),
        year = d3.time.format( '%Y' ),
        monthNumber = d3.time.format( '%m' ),
        percent = d3.format( '.1%' ),
        format = d3.time.format( '%Y-%m-%d' )
    
    var url = window.location.pathname
    url = url.length <= 1 ? '/shifts/open' : url
    if( url == '/shifts' || url == '/shifts/open' ) {
        d3.json( '/tasks.json', function( error, tasks ) {
            var newTasks = {}
            tasks.forEach( function( t ) { newTasks[t.id] = t } )
            tasks = newTasks
            
            d3.json( url + '.json', function( error, shifts ) {
                for( var i = 0; i < shifts.length; i++ ) {
                    shifts[i].start = new Date( Date.parse(shifts[i].start ) )
                    shifts[i].end = new Date( Date.parse(shifts[i].end ) )
                }
                
                var start = new Date( d3.min( shifts, function( d ) { return d.start } ) )
                var end = new Date( d3.max( shifts, function( d ) { return d.end } ) )
                
                start.setDate( start.getDate() - 7 ) // Range is exclusive

                var interval = d3.time.weeks( start, end )

                var nextWeek = function( d ) {
                    var nextWeek = new Date( d )
                    nextWeek.setDate( d.getDate() + 7 )
                    return nextWeek
                }

                var weekBounds = d3.nest()
                    .key( function( d ) { return week( d.start ) } )
                    .rollup( function( d ) {
                        return {
                            start: d3.min( d, function( d ) { return d.start.getHours() } ),
                            end: d3.max( d, function( d ) { return d.end.getHours() } ),
                        }
                    } )
                    .map( shifts )
                
                var shiftStarts = d3.nest()
                    .key( function( d ) { return d.start } )
                    .rollup( function( d ) { return d } )
                    .map( shifts )

                interval.forEach( function( day, index ) {
                    var weekdays = d3.time.days( day, nextWeek( day ) )
    
                    var titles = d3.select( '#shifts' )
                        .append( 'ol' )
                        .classed( 'titles', true )
                        .datum( day )
    
                    titles.append( 'li' )
    
                    titles.selectAll( '.title' )
                        .data( weekdays )
                        .enter()
                        .append( 'li' )
                        .classed( 'title', true )
                        .attr( {
                            weekday: weekday
                        } )
                        .text( d3.time.format( '%-d' ) )
    
                    if( index == 0 || month( day ) != month( nextWeek( day ) ) ) {
                        titles
                            .append( 'li' )
                            .classed( 'month', true )
                            .text( function() { return month( nextWeek( day ) ) } )
                    }

                    if( week( day ) in weekBounds ) {
                        for( var currentHour = weekBounds[week( day )].start; currentHour < weekBounds[week( day )].end; currentHour++ ) {
                            var weeks = d3.select( '#shifts' )
                                .append( 'ol' )
                                .classed( 'hours', true )
                                .datum( function() {
                                    day.setHours( currentHour )
                                    return day
                                } )

                            
                            weeks.append( 'li' )
                                .classed( 'legend', true )
                                .text( function( d ) { return hour( d ) + "–" + ( parseInt( hour( d ) ) + 1 ) + ":00" } )
                            
                            var hours = weeks.selectAll( '.hour' )
                                .data( weekdays )
                                .enter()
                                .append( 'li' )
                                .classed( 'hour', true )
                                .attr( {
                                    weekday: weekday
                                } )
                                .append( 'ul' )
                                .classed( 'shifts', true )
                                .datum( function( d ) {
                                    d.setHours( currentHour )
                                    return d
                                } )
                            
                            var shifts = hours.filter( function( d ) { return d in shiftStarts } )
                                .classed( 'open', true )
                                .selectAll( '.shift' )
                                .data( function( d ) { return shiftStarts[d] } )
                                .enter()
                                .append( 'li' )
                                .classed( 'shift', true )
                                .classed( 'taken', function( d ) { return d.taken } )
                                .on( 'dblclick', function( d ) { window.location = d.url } )
                                .append( 'label' )
                                .attr( {
                                    title: function( d ) {
                                        return tasks[d.task_id].name + " (×" + d.needed + ")"
                                    }
                                } )
                            
                            shifts
                                .append( 'input' )
                                .attr( {
                                    type: 'radio',
                                    name: function( d ) { return 'shift[' + d.start + ']' } 
                                } )
                            
                            shifts
                                .append( 'img' )
                                .classed( 'icon', true )
                                .attr( {
                                    src: function( d ) { return tasks[d.task_id] ? tasks[d.task_id].icon : null }
                                } )
                        }
                    }
                } )

                $(document).trigger( 'shifts:loaded' )
            } )
        } )
    }
}

// Load on turbolinks page change
$(document).on( 'page:load', renderShiftsCalendar )
$(document).ready( renderShiftsCalendar )

$(document).on( 'shifts:loaded', function() {
    $('#take-shifts')
        .click( function() {
            var selected = d3.selectAll( 'input:checked' )
                .map( function( selection ) {
                    return selection.map( function( d ) {
                        return d3.select( d ).data()[0]
                    } )
                } )[0]
            var ids = selected.map( function( d ) { return d.id } )
            var $form = $('#shifts-form form')
            ids.forEach( function( id ) {
                $form.append( $('<input/>')
                              .attr( { name: 'shift_ids[]' } )
                              .val( id )
                            )
            } )
            if( ids.length > 0 ) {
                $form.submit()
            }
        } )

    // Disable hours where a shift is taken
    $('.taken').parent()
        .addClass( 'taken' )
        .find( 'input' ).attr( { disabled: true } )

    // Allow unselecting shifts
    $('label').click( function( event ) { 
        event.preventDefault()
        var $input = $(this).find('input');
        if( ! $input.prop( 'disabled' ) && ! $input.prop( 'checked' ) ) {
            $input.prop( { checked: true } )
        } else {
            $input.prop( { checked: false } )
        }
    } )

    if( navigator.userAgent.match( /Chrome/ ) ) {
        $('body').addClass( 'chrome' )
    }
} )

$.fn.datepicker.defaults.format = 'yyyy/m/d'

;( function( i, s, o, g, r, a, m ) {
    i['GoogleAnalyticsObject'] = r;
    i[r] = i[r] || function() {
        (i[r].q = i[r].q || []).push( arguments )
    }
    i[r].l = 1 * new Date()
    a = s.createElement( o )
    m = s.getElementsByTagName( o )[0]
    a.async = 1
    a.src = g
    m.parentNode.insertBefore( a, m )
} )( window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga' )

ga('create', 'UA-46155649-1', 'vols.herokuapp.com');
ga('send', 'pageview');
