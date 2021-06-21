class Utils {
    static getFormattedTime() {
        let d = new Date();
        return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate() + "-" + d.getHours() + "-" + d.getMinutes() + "-" + d.getSeconds();
    }
    static formatMMSS(time) {
        var minutes = Math.floor(time / 60);
        var seconds = (time - minutes * 60).toFixed(2);
        if (minutes.toString().length < 2) minutes = "0" + minutes;
        if (seconds.toString().length < 5) seconds = "0" + seconds;
        return minutes + ":" + seconds;
    }
}

export default Utils