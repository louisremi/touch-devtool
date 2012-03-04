(function(window,document,Math,undefined){

var div = document.createElement("div"),
	divStyle = div.style,
	prefixes = ["O","ms","Webkit","Moz",""],
	i = prefixes.length,
	_Transition = "Transition",
	transition, tmp,
	listeners, type,
	points, circle,
	draggedPoint, draggedHandle, moveCount = 0, prevData,
	prepareEvent, createTouch, createTouchList;

// -- Vendor Prefix Detection -------------------------------
while ( i-- ) {
	tmp = prefixes[i] + ( prefixes[i] ? _Transition : _Transition.toLowerCase() );
	if ( tmp in divStyle ) {
		transition = tmp;
		break;
	}
}

// -- Global Utils ------------------------------------------

// emulate document.createTouch & document.createTouchList if necessary
createTouch = document.createTouch ?
	// we can't do `createTouch = document.createTouch`or we get "Illegal operation on Wrapped Native prototype object"
	function() { return document.createTouch.apply( document, arguments ); } :
	function( view, target, id, pageX, pageY, screenX, screenY, clientX, clientY ) {
		return {
			identifier: id,
			target: target,
			screenX: screenX,
			screenY: screenY,
			clientX: clientX,
			clientY: clientY,
			pageX: pageX,
			pageY: pageY
		};
	};
createTouchList = document.createTouchList ?
	function( touchArray ) { return document.createTouchList( touchArray ); } :
	function( touchArray ) {
		touchArray.identifiedTouch = function( id, i ) {
			i = this.length;
			while ( i-- ) {
				if ( this[i].identifier == id ) {
					return this[i];
				}
			}
		};
		return touchArray;
	};

// Determine how touch events should be prepared
try {
	tmp = document.createEvent( "touchevent" );
	// Chrome will throw on this step
	tmp.initTouchEvent;

	// Firefox way
	prepareEvent = function( type, e, touches, targetTouches ) {
		var evt = document.createEvent( "touchevent" );

		evt.initTouchEvent(
			// event type
			type,
			//  can bubble
			true,
			// cancelable
			true,
			// AbstractView
			window,
			// detail
			0,
			// keys
			e.ctrlKey,
			e.altKey,
			e.shiftKey,
			e.metaKey,
			// touches
			touches,
			// target touches
			targetTouches,
			// changed touches
			touches
		);

		return evt;
	};

} catch(e) {
	// Chrome Way
	prepareEvent = function( type, e, touches, targetTouches ) {
		var evt = document.createEvent( "HTMLEvents" );

		evt.initEvent(
			// event type
			type,
			//  can bubble
			true,
			// cancelable
			true
		);

		evt.eventName = type;
		evt.touches = touches;
		evt.targetTouches = targetTouches;
		evt.changedTouches = touches;
		evt.altKey = e.altKey;
		evt.metaKey = e.metaKey;
		evt.ctrlKey = e.ctrlKey;
		evt.shiftKey = e.shiftKey;

		return evt;
	};
}

// this isn't pretty but it improves minification
function preventDefault( e ) {
	e.preventDefault();
}

// -- Event Listeners ---------------------------------------

listeners = {
	// add/remove points on Shift+Click
	click: function( e ) {
		var point;

		if ( e.shiftKey && moveCount < 6 && !draggedHandle ) {
			points.length() && ( point = points.get( e.pageX, e.pageY ) ) ?
				points.remove( point.id ) :
				points.add( e );

				preventDefault(e);
		}

		draggedHandle = undefined;
		moveCount = 0;
	},

	mousedown: function( e ) {
		var point,
			_touchstart = "touchstart";

		// points logic
		if ( !e.ctrlKey && !e.metaKey && ( point = points.get( e.pageX, e.pageY ) ) ) {

			draggedPoint = point;

			// only move the point if shift is down
			if ( !e.shiftKey ) {
				point.down();
				point.trigger( _touchstart, e );
			}

			//  turn off transitions while a point is being dragged
			points.handles && points.handles.transition( false );

			preventDefault(e);

		// handles logic
		} else if ( ( e.ctrlKey || e.metaKey )  && e.target.className == "tchHandle" ) {
			prevData = e.target.id == "tchSwipe" ?
				[ e.pageX, e.pageY ] :
				[ 0, 1 ];

			draggedHandle = e.target.id;

			if ( !e.shiftKey ) {
				points.down();
				points.trigger( _touchstart, e );
			}

			preventDefault(e);
		}
	},

	mouseup: function( e ) {
		var point,
			_touchend = "touchend";

		// points logic
		if ( draggedPoint ) {

			if ( draggedPoint.inContact ) {
				draggedPoint.up();
				draggedPoint.trigger( _touchend, e );
			}

			// turn on transitions after a point moved
			points.handles && points.handles.transition( true );

			draggedPoint = undefined;

			preventDefault(e);

		// handles logic
		} else if ( draggedHandle ) {

			if ( points.inContact ) {
				points.up();
				points.trigger( _touchend, e );
			}

			if ( !e.ctrlKey && !e.metaKey ) {
				points.handles.draggable( false );
				// rotate/pinch handle should be restored back to its initial position after use
				points.handles.move( points.handles.centerX, points.handles.centerY );
			}

			// draggedPoint shouldn't be switched to undefined here, because click events happens after mouseup
			// this would create a new point everytime the handle is released
			//draggedPoint = undefined;

			preventDefault(e);
		}
	},

	mousemove: function( e ) {
		var dX, dY, tmpA, tmpS,
			_touchmove = "touchmove";

		// points logic
		if ( draggedPoint ) {

			moveCount++;

			draggedPoint.move( e.pageX, e.pageY );

			points.handles && points.handles.move( points.center() );

			draggedPoint.inContact && draggedPoint.trigger( _touchmove, e );

			preventDefault(e);

		// handles logic
		} else if ( draggedHandle ) {
			// swipe handle
			if ( draggedHandle == "tchSwipe" ) {

				dX = e.pageX - prevData[0];
				dY = e.pageY - prevData[1];

				points.moveBy( dX, dY );
				points.handles.move( e.pageX, e.pageY );

				prevData = [ e.pageX, e.pageY ];

			// rotate / pinch handle
			} else {
				points.handles.moveRP( e.pageX, e.pageY );

				// scale relative to origin
				dX = e.pageX - points.handles.centerX;
				dY = e.pageY - points.handles.centerY;
				tmpS = Math.sqrt( dX * dX + dY * dY ) / 100;

				// angle relative to origin
				tmpA = -Math.atan2( dX, dY ) + Math.PI/2;
				points.rotate_pinch(
					// angle relative to previous one
					tmpA - prevData[0],
					// scale
					( tmpS - prevData[1] ) / prevData[1]
				);
				prevData = [ tmpA, tmpS ];
			}

			points.inContact && points.trigger( _touchmove, e );

			preventDefault(e);
		}
	},

	// remove all points on Shift+Escape
	keypress: function( e ) {
		if ( e.charCode == 0 && e.shiftKey ) {
			points.remove();

			preventDefault(e);
		}
	},

	// activate handles on !Ctrl or !Cmd
	keydown: function( e ) {
		if ( ( e.keyCode == 17 || e.keyCode == 224 ) && points.handles ) {
			points.handles.draggable( true );

			preventDefault(e);
		}
	},

	keyup: function( e ) {
		if ( ( e.keyCode == 17 || e.keyCode == 224 ) && points.handles && !draggedHandle ) {
			points.handles.draggable( false );
			points.handles.move( points.handles.centerX, points.handles.centerY );

			preventDefault(e);
		}
	},

	// prevent text selection, because of Chrome
	selectstart: function( e ) {
		preventDefault(e);
	}
};

// -- Circle ------------------------------------------------

// Not a Class definition, but close
circle = document.createElement( "div" );
circle.style.position = "absolute";
circle.style.display = "block";
circle.style.visibility = "visible";
circle.style.zIndex = 999;
circle.style.margin = circle.style.padding = 0;
circle.style.width = circle.style.height = "20px";
circle.style.borderRadius = "10px";
circle.style.boxShadow = "1px 1px 3px #333";
circle.style.background = "#003";
circle.style.opacity = .3;

// -- Points ------------------------------------------------

function Points() {
	this.list = {};
}

Points.prototype = {
	add: function( e ) {
		var id =  "tch" + Math.round( Math.random() * 1E6 ),
			length;

		this.list[ id ] = new Point( e, id );
		length = this.length();

		if ( length == 2 ) {
			this.handles = new Handles( this.center() );
		}
		if ( length > 2 ) {
			this.handles.move( this.center() );
		}
	},

	remove: function( e ) {
		var pts = e ?
				// if an event is specified, remove a single point
				{a: this.get( e ) } :
				// without arguments, all points are removed from the list
				this.list,
			id;

		for ( id in pts ) {
			pts[ id ].remove();
			delete this.list[ pts[ id ].id ];
		}

		length = this.length();
		if ( length < 2 && this.handles ) {
			this.handles.remove();
			this.handles = undefined;
		}
		if ( length > 1 ) {
			this.handles.move( this.center() );
		}
	},

	get: function( x, y ) {
		// get point by position
		if ( y ) {
			// points have pointerEvents == "none" and are thus invisible to document.elementFromPoint
			// we have to find them manually
			var point;
			this.each(function(i,pt) {
				if ( x < pt.centerX + 11 && x > pt.centerX - 11 && y < pt.centerY + 11 && y > pt.centerY - 11 ) {
					return point = pt;
				}
			});
			return point;

		// get point by id
		} else {
			return this.list[ x.target && x.target.id || x ];
		}
	},

	length: function() {
		return Object.keys( this.list ).length;
	},

	each: function( callback ) {
		for ( var id in this.list ) {
			// iterate until a callback returns true
			if ( callback( id, this.list[id] ) ) {
				break;
			};
		}
	},

	center: function() {
		var top = 1E5,
			right = 0,
			left = 1E5,
			bottom = 0;

		this.each(function(i,pt) {
			if ( pt.centerX > right ) {
				right = pt.centerX;
			}
			if ( pt.centerX < left ) {
				left = pt.centerX;
			}
			if ( pt.centerY > bottom ) {
				bottom = pt.centerY;
			}
			if ( pt.centerY < top ) {
				top = pt.centerY;
			}
		});

		return [ left + ( right - left ) / 2, top + ( bottom - top ) / 2 ];
	},

	down: function() {
		this.inContact = true;

		this.each(function(i,pt) {
			pt.down();
		});
	},

	up: function() {
		this.inContact = false;

		this.each(function(i,pt) {
			pt.up();
		});
	},

	moveBy: function( x, y ) {
		this.each(function(i,pt) {
			pt.move( pt.centerX + x, pt.centerY + y );
		});
	},

	rotate_pinch: function( angle, scale ) {
		var dX, dY, hypotenuse, a,
			self = this;

		this.each(function(i,pt) {
			dX = pt.centerX - self.handles.centerX;
			dY = pt.centerY - self.handles.centerY;

			a = -Math.atan2( dX, dY ) + Math.PI/2 + angle;

			hypotenuse = Math.sqrt( dX * dX + dY * dY );

			hypotenuse += hypotenuse * scale;

			pt.move( Math.cos( a ) * hypotenuse + self.handles.centerX, Math.sin( a ) * hypotenuse + self.handles.centerY );
		});
	},

	touchList: function( type, e ) {
		var pts = [], i = 0;

		this.each(function(j,pt) {
			pts.push( pt.touch( type, e, i++ ) );
		});

		return createTouchList( pts );
	},

	trigger: function( type, e ) {
		var touchList = this.touchList( type, e );

		this.each(function(i,pt) {
			pt.trigger( type, e, touchList );
		});
	}
};

// -- Point -------------------------------------------------

function Point( e, id ) {
	var el = circle.cloneNode( false );

	this.centerX = e.pageX;
	this.centerY = e.pageY;
	el.style.left = ( this.centerX - 11 ) + "px";
	el.style.top = ( this.centerY - 11 ) + "px";

	el.style.pointerEvents = "none";

	el.className = "tchPoint";
	this.id = el.id = id;

	this[0] = document.body.appendChild( el );
}

Point.prototype = {
	remove: function() {
		document.body.removeChild( this[0] );
	},

	down: function() {
		this[0].style.left = ( this.centerX - 10 ) + "px";
		this[0].style.top = ( this.centerY - 10 ) + "px";
		this[0].style.boxShadow = "none";
		this[0].style.opacity = .5;
		this[0].style.zIndex = 1000;

		this.inContact = true;
	},

	up: function() {
		this[0].style.left = ( this.centerX - 11 ) + "px";
		this[0].style.top = ( this.centerY - 11 ) + "px";
		this[0].style.boxShadow = "1px 1px 3px #300";;
		this[0].style.opacity = .3;
		this[0].style.zIndex = 999;

		this.inContact = false;
	},

	move: function( x, y ) {
		this.centerX = x;
		this.centerY = y;
		this[0].style.left = ( x - 10 ) + "px";
		this[0].style.top = ( y - 10 ) + "px";
	},

	touch: function( type, e, id ) {

		type == "touchstart" && ( this.target = document.elementFromPoint( this.centerX - scrollX, this.centerY - scrollY ) );

		var created = createTouch(
			// view
			window,
			// target
			this.target,
			// identifier
			id || 0,
			// pageX
			this.centerX,
			// pageY
			this.centerY,
			// screenX
			this.centerX + e.screenX - e.pageX,
			// screenY
			this.centerY + e.screenY - e.pageY,
			// clientX
			this.centerX + e.clientX - e.pageX,
			// clientY
			this.centerY + e.clientY - e.pageY
		);

		return created;
	},

	touchList: function( type, e ) {
		return createTouchList( [ this.touch( type, e ) ] );
	},

	// create, init and dispatch a touch event on the touch target
	trigger: function( type, e, touchList ) {
		// if the touchList is undefined, it will contain only this point
		touchList || ( touchList = this.touchList( type, e ) );

		var targetTouches = [],
			l = touchList.length, i = -1;

		// filter target touches
		while ( ++i < l ) {
			// targetTouches share the same target
			if ( touchList[i].target == this.target ) {
				targetTouches.push( touchList[i] );
			}
		}
		targetTouches = createTouchList( targetTouches );

		this.target.dispatchEvent( prepareEvent( type, e, touchList, targetTouches ) );

		type == "touchend" && ( this.target = undefined );
	}
};

// -- Handles -----------------------------------------------

function Handles( pos ) {
	var sHandle = circle.cloneNode( false ),
		rpHandle = circle.cloneNode( false );

	sHandle.style.background = "#300";
	rpHandle.style.background = "#030";
	sHandle.style.width = sHandle.style.height = rpHandle.style.width = rpHandle.style.height = "16px";

	rpHandle.className = sHandle.className = "tchHandle";
	sHandle.id = "tchSwipe";
	rpHandle.id = "tchPR";

	this[0] = document.body.appendChild( sHandle );
	this[1] = document.body.appendChild( rpHandle );

	this.move( pos );
	this.draggable( false );
}

Handles.prototype = {
	remove: function() {
		document.body.removeChild( this[0] );
		document.body.removeChild( this[1] );
	},

	move: function( x, y ) {
		if ( x.length ) {
			y = x[1];
			x = x[0];
		}

		this.centerX = x;
		this.centerY = y;
		this[0].style.left = ( this.centerX - 11 ) + "px";
		this[0].style.top = ( this.centerY - 11 ) + "px";
		this[1].style.left = ( this.centerX + 89 ) + "px";
		this[1].style.top = ( this.centerY - 11 ) + "px";
	},

	moveRP: function( x, y ) {
		this[1].style.left = ( x - 11 ) + "px";
		this[1].style.top = ( y - 11 ) + "px";
	},

	draggable: function( bool ) {
		this[0].style.zIndex = this[1].style.zIndex = ( bool ? 1000 : 998 );
		this[0].style.opacity = this[1].style.opacity = ( bool ? .5 : .15 );

		this.transition( !bool );
	},

	transition: function( bool ) {
		this[0].style[ transition ] = this[1].style[ transition ] = ( bool ? "top .8s, left .8s" : "none" );
	}
}

// -- Init --------------------------------------------------

points = new Points();

// Register event listeners
for ( type in listeners ) {
	document.addEventListener( type, listeners[ type ], false);
}

})(window,document,Math);