(function(window,document,Math,undefined){

var div = document.createElement("div"),
	divStyle = div.style,
	prefixes = ["O","ms","Webkit","Moz",""],
	i = prefixes.length,
	_Transition = "Transition",
	transition, tmp,
	listeners, type,
	touchs,
	movingTouch, movingHandle, prevData,
	prepareEvent, createTouch, createTouchList,
	circle;

// vendor prefix detection
while ( i-- ) {
	tmp = prefixes[i] + ( prefixes[i] ? _Transition : _Transition.toLowerCase() );
	if ( tmp in divStyle ) {
		transition = tmp;
		break;
	}
}

// emulate document.createTouch & document.createTouchList if necessary
createTouch = document.createTouch || document.createTouch ?
	// we can't do `createTouch = document.createTouch`or we get "Illegal operation on WrappedNative prototype object"
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

listeners = {
	click: function( e ) {
		var className = e.target.className,
			touch;

		if ( e.shiftKey ) {
			touchs.length() && ( touch = touchs.get( e.pageX, e.pageY ) ) ?
				touchs.remove( touch.id ) :
				touchs.add( e );
		}
	},

	keypress: function( e ) {
		if ( e.charCode == 0 && e.shiftKey ) {
			touchs.remove();
			e.preventDefault();
		}
	},

	mousedown: function( e ) {
		var touch,
			className = e.target.className,
			_touchstart = "touchstart";

		// touch point
		if ( !e.shiftKey && !e.ctrlKey && ( touch = touchs.get( e.pageX, e.pageY ) ) ) {

			movingTouch = touch.down();
			movingTouch.triggerTouch( _touchstart, e );

			// hide handles while a single touch is being moved
			touchs.handles && touchs.handles.hide();

			e.preventDefault();

		// touch handle
		} else if ( e.ctrlKey && className == "tchHandle" ) {
			prevData = e.target.id == "tchSwipe" ?
				[ e.pageX, e.pageY ] :
				[ 0, 1 ];
			movingHandle = e.target.id;

			touchs.down();
			touchs.triggerTouchs( _touchstart, e );

			e.preventDefault();
		}
	},

	mouseup: function( e ) {
		var touch,
			className = e.target.className,
			_touchend = "touchend";

		// touch point
		if ( movingTouch ) {
			movingTouch.up();
			movingTouch.triggerTouch( _touchend, e );
			movingTouch = undefined;

			// update handles positions and show them
			touchs.handles && ( touchs.handles.move( touchs.center() ), touchs.handles.show() );

		// touch handle
		} else if ( movingHandle ) {
			touchs.up();
			touchs.triggerTouchs( _touchend, e );
			e.ctrlKey || touchs.handles.off();
			movingHandle = undefined;

			// update handles positions
			touchs.handles.move( touchs.handles.centerX, touchs.handles.centerY );
		}

		e.preventDefault();
	},

	mousemove: function( e ) {
		var className = e.target.className,
			dX, dY, tmpA, tmpS,
			_touchmove = "touchmove";

		// touch point
		if ( movingTouch ) {
			movingTouch.move( e.pageX, e.pageY );
			movingTouch.triggerTouch( _touchmove, e );

			e.preventDefault();

		// touch handle
		} else if ( movingHandle ) {
			// swipe handle
			if ( movingHandle == "tchSwipe" ) {

				dX = e.pageX - prevData[0];
				dY = e.pageY - prevData[1];
				touchs.moveBy( dX, dY );
				touchs.handles.move( e.pageX, e.pageY );

				prevData = [ e.pageX, e.pageY ];

			// rotate / pinch handle
			} else {
				touchs.handles.moveRP( e.pageX, e.pageY );

				// scale relative to origin
				dX = e.pageX - touchs.handles.centerX;
				dY = e.pageY - touchs.handles.centerY;
				tmpS = Math.sqrt( dX * dX + dY * dY ) / 100;

				// angle relative to origin
				tmpA = -Math.atan2( dX, dY ) + Math.PI/2;
				touchs.rp(
					// angle relative to previous one
					tmpA - prevData[0],
					// scale
					( tmpS - prevData[1] ) / prevData[1]
				);
				prevData = [ tmpA, tmpS ];
			}

			touchs.triggerTouchs( _touchmove, e );
		}
	},

	keydown: function( e ) {
		if ( e.keyCode == 17 && touchs.handles ) {
			touchs.handles.on();
		}
	},

	keyup: function( e ) {
		if ( e.keyCode == 17 && touchs.handles && !movingHandle ) {
			touchs.handles.off();
		}
	},

	// prevent text selection in Chrome
	selectstart: function( e ) {
		e.preventDefault();
	}
};

// -- Touchs ------------------------------------------------

function Touchs() {
	this.list = {};
}

Touchs.prototype = {
	add: function( e ) {
		var id =  "tch" + Math.round( Math.random() * 1E6 ),
			length;

		this.list[ id ] = new Touch( e, id );
		length = this.length();

		if ( length == 2 ) {
			this.handles = new Handles( this.center() );
		}
		if ( length > 2 ) {
			this.handles.move( this.center() );
		}
	},

	remove: function( e ) {
		var touchs = e ?
				// if an event is specified, remove a single point
				{a: this.get( e ) } :
				// without arguments, all points are removed from the list
				this.list,
			id;

		for ( id in touchs ) {
			touchs[ id ].remove();
			delete this.list[ touchs[ id ].id ];
		}

		length = this.length();
		if ( length < 2 ) {
			this.handles.remove();
			this.handles = undefined;
		}
		if ( length > 1 ) {
			this.handles.move( this.center() );
		}
	},

	get: function( x, y ) {
		// get touch by position
		if ( y ) {
			// touch points have pointerEvents == "none" and are thus invisible to document.elementFromPoint
			// we have to do that manually
			var id,	touch;

			for ( id in this.list ) {
				touch = this.list[ id ];
				if ( x < touch.centerX + 11 && x > touch.centerX - 11 && y < touch.centerY + 11 && y > touch.centerY - 11 ) {
					return touch;
				}
			}

		// get Touch by id
		} else {
			return this.list[ x.target && x.target.id || x ];
		}
	},

	length: function() {
		return Object.keys( this.list ).length;
	},

	center: function() {
		var top = 1E5, right = 0, left = 1E5, bottom = 0,
			id, touch;
	
		for ( id in this.list ) {
			touch = this.list[ id ];

			if ( touch.centerX > right ) {
				right = touch.centerX;
			}
			if ( touch.centerX < left ) {
				left = touch.centerX;
			}
			if ( touch.centerY > bottom ) {
				bottom = touch.centerY;
			}
			if ( touch.centerY < top ) {
				top = touch.centerY;
			}
		}
	
		return [ left + ( right - left ) / 2, top + ( bottom - top ) / 2 ];
	},

	down: function() {
		for ( var id in this.list ) {
			this.list[ id ].down();
		}
	},

	up: function() {
		for ( var id in this.list ) {
			this.list[ id ].up();
		}
	},

	moveBy: function( x, y ) {
		var id, point;

		for ( id in this.list ) {
			point = this.list[ id ];
			point.move( point.centerX + x, point.centerY + y );
		}
	},

	rp: function( angle, scale ) {
		var id, point, dX, dY, hypotenuse, a;

		for ( id in this.list ) {
			point = this.list[ id ];

			dX = point.centerX - this.handles.centerX;
			dY = point.centerY - this.handles.centerY;

			a = -Math.atan2( dX, dY ) + Math.PI/2 + angle;

			hypotenuse = Math.sqrt( dX * dX + dY * dY );

			hypotenuse += hypotenuse * scale;

			point.move( Math.cos( a ) * hypotenuse + this.handles.centerX, Math.sin( a ) * hypotenuse + this.handles.centerY );
		}
	},

	touchList: function( type, e ) {
		var tchs = [], id, i = 0;

		// all touch points at once
		for ( id in this.list ) {
			tchs.push( this.list[ id ].touch( type, e, i++ ) );
		}

		return createTouchList( tchs );
	},

	triggerTouchs: function( type, e ) {
		var touchList = this.touchList( type, e ),
			id;

		for ( id in this.list ) {
			this.list[ id ].triggerTouch( type, e, touchList );
		}
	}
};

// -- Touch -------------------------------------------------

function Touch( e, id ) {
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

Touch.prototype = {
	remove: function() {
		document.body.removeChild( this[0] );
	},

	down: function() {
		this[0].style.left = ( this.centerX - 10 ) + "px";
		this[0].style.top = ( this.centerY - 10 ) + "px";
		this[0].style.boxShadow = "none";
		this[0].style.opacity = .5;
		this[0].style.zIndex = 1000;

		return this;
	},

	up: function() {
		this[0].style.left = ( this.centerX - 11 ) + "px";
		this[0].style.top = ( this.centerY - 11 ) + "px";
		this[0].style.boxShadow = "1px 1px 3px #300";;
		this[0].style.opacity = .3;
		this[0].style.zIndex = 999;
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
	triggerTouch: function( type, e, touchList ) {
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
	var sHandle = circle.cloneNode(),
		rpHandle = circle.cloneNode();

	sHandle.style.background = "#300";
	rpHandle.style.background = "#030";
	sHandle.style.width = sHandle.style.height = rpHandle.style.width = rpHandle.style.height = "16px";

	rpHandle.className = sHandle.className = "tchHandle";
	sHandle.id = "tchSwipe";
	rpHandle.id = "tchPR";

	this[0] = document.body.appendChild( sHandle );
	this[1] = document.body.appendChild( rpHandle );
	
	this.move( pos );
	this.off();
}

Handles.prototype = {
	remove: function() {
		document.body.removeChild( this[0] );
		document.body.removeChild( this[1] );
	},

	hide: function() {
		this[0].style.display = this[1].style.display = "none";
	},
	
	show: function() {
		this[0].style.display = this[1].style.display = "block";
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

	on: function() {
		this[0].style.zIndex = this[1].style.zIndex = 1000;
		this[0].style.opacity = this[1].style.opacity = .5;
		this[0].style[ transition ] = this[1].style[ transition ] = "none";
	},

	off: function() {
		this[0].style.zIndex = this[1].style.zIndex = 998;
		this[0].style.opacity = this[1].style.opacity = .15;
		this[0].style[ transition ] = this[1].style[ transition ] = "top .8s, left .8s";	
	}
}

// -- Init --------------------------------------------------

touchs = new Touchs;

// Register event listeners
for ( type in listeners ) {
	document.addEventListener( type, listeners[ type ], false);
}

})(window,document,Math);