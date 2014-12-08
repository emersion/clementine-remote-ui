var tmp = require('tmp');
var fs = require('fs');
var ClementineClient = require('clementine-remote').Client;
var Remote = require('mpris-service');

tmp.setGracefulCleanup(); // Remove tmp files on exit

// Get argv
var argv = process.argv;
if (argv[0] == 'node') {
	argv = argv.slice(2);
} else {
	argv = argv.slice(1);
}

var clientOpts = {
	host: '127.0.0.1',
	port: 5500,
	auth_code: undefined
};

// Parse cli options
if (argv.length > 0) {
	var host = argv[0];
	if (~host.indexOf(':')) {
		var hostParts = host.split(':');
		clientOpts.host = hostParts[0];
		clientOpts.port = parseInt(hostParts[1]);
	} else {
		clientOpts.host = host;
	}

	if (argv.length > 1) {
		clientOpts.auth_code = parseInt(argv[1]);
	}
}

console.log('Connecting to '+clientOpts.host+':'+clientOpts.port+' ' + ((typeof clientOpts.auth_code == 'number') ? ' (with an auth code)' : ''));

var player = ClementineClient(clientOpts);

var remote = Remote({
	name: 'clementineRemote',
	identity: 'Clementine remote',
	supportedUriSchemes: ['file'],
	supportedMimeTypes: ['audio/mpeg', 'application/ogg']
});

player.on('connect', function () {
	console.log('client connected');
	player.on('song', function (song) {
		console.log('Now playing', song.title);
		
		// @see http://www.freedesktop.org/wiki/Specifications/mpris-spec/metadata/
		var metadata = {
			'mpris:trackid': song.index, //TODO
			'mpris:length': song.length * 1000000
		};
		if (song.album) {
			metadata['xesam:album'] = song.album;
		}
		if (song.artist) {
			metadata['xesam:artist'] = song.artist;
		}
		if (song.albumartist) {
			metadata['xesam:albumArtist'] = song.albumartist;
		}
		if (song.pretty_year) {
			metadata['xesam:contentCreated'] = new Date(parseInt(song.pretty_year, 10)).toISOString();
		}
		if (song.disc >= 0) {
			metadata['xesam:discNumber'] = song.disc;
		}
		if (song.genre) {
			metadata['xesam:genre'] = song.genre;
		}
		if (song.title) {
			metadata['xesam:title'] = song.title;
		}
		if (song.track >= 0) {
			metadata['xesam:trackNumber'] = song.track;
		}
		if (song.playcount >= 0) {
			metadata['xesam:useCount'] = song.playcount;
		}
		if (song.rating >= 0) {
			metadata['xesam:userRating'] = song.rating;
		}
		if (song.art) {
			tmp.file({ postfix: '.jpg' }, function (err, path, fd) {
				if (err) {
					console.error('WARN: cannot create tmp file for cover art', err);
					return;
				}

				fs.writeFile(path, song.art.toBuffer(), function (err) {
					if (err) {
						console.error('WARN: cannot write tmp file for cover art', err);
						return;
					}
					metadata['mpris:artUrl'] = 'file://'+path;
					remote.metadata = metadata;
				});
			});
		}
		remote.metadata = metadata;
	});

	player.on('play', function () {
		remote.playbackStatus = 'Playing';
	});
	player.on('pause', function () {
		remote.playbackStatus = 'Paused';
	});
	player.on('stop', function () {
		remote.playbackStatus = 'Stopped';
	});
	player.on('volume', function (value) {
		remote.volume = value / 100;
	});

	remote.on('raise', function () { /* TODO */ });
	remote.on('quit', function () {
		player.stop();
		player.end(); // Disconnect
	});
	remote.on('next', function () {
		player.next();
	});
	remote.on('previous', function () {
		player.previous();
	});
	remote.on('play', function () {
		player.play();
	});
	remote.on('pause', function () {
		player.pause();
	});
	remote.on('playpause', function () {
		player.playpause();
	});
	remote.on('stop', function () {
		player.stop();
	});
	remote.on('seek', function (data) {
		console.log('seek', data); //TODO
	});
	remote.on('position', function () { /* TODO */ });
	remote.on('open', function () { /* TODO */ });
	remote.on('volume', function (value) { /* TODO (value is between 0 and 1) */ });
});
player.on('disconnect', function (data) {
	console.log('client disconnecting', data);
});
player.on('end', function () {
	console.log('client disconnected');
	process.exit();
});
