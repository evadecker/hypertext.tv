# Contribution Guide

Add your sites to Hypertext TV.

## What sites do you accept?

We'll air [handmade websites](https://luckysoap.com/statements/handmadeweb.html) of any size! Games, personal sites, art, poetry, interactive experiences, toys, explorations—anything special. It can be a small as [a single photo of a potato](https://po.ta.to/) or as large as an [interactive explorable about mechanical watches](https://ciechanow.ski/mechanical-watch/).

> [!IMPORTANT]  
> We do not accept:
> 
> - Links to large platforms like YouTube, Instagram, Spotify, Soundcloud, Medium, etc.
> - Marketing sites or anything with ads
> - AI-generated content
> - Sites promoting racism, homophobia, transphobia, fatphobia, or other assholery
> - Insecure sites (sites *must* use the `https://` protocol, not `http://`)

## How do I add my site?

Create a pull request against this repository by [forking it](https://docs.github.com/en/get-started/exploring-projects-on-github/contributing-to-a-project) or by editing the file from the GitHub interface.

1. Go to [src/channels](https://github.com/evadecker/hypertext.tv/tree/main/src/channels).
2. This folder contains `.yml` files which define the airing schedule for each channel: games, art, music, personal, poetry, single-use, explorables, archives, and misc. Select a channel for your site and open its `.yml` file.
3. Find a day and time within `schedule` for your website to air.
4. Add your site details. For example:

```yml
- wednesday:
  - "14:00": 
      title: Design Is 
      # (Optional) Your name, nickname, or handle
      # To be displayed on the credits page
      # Multiple authors can be listed
      author: Eva Decker 
      # A link to your website, using https://
      url: https://design.eva.town 

# Important: YAML is whitespace-sensitive.
# Make sure your entries are indented 2 spaces beneath the time block!
```

5. Save and commit your changes, then [open a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).
6. Your change will be reviewed. If everything looks good, it'll deploy to Hypertext TV! Enjoy seeing your site air each week.

## Previewing your site

To preview your site, visit [hypertext.tv/test](https://hypertext.tv/test) and enter your site URL.

> [!NOTE]
> Hypertext TV displays sites using [iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe). If your domain explicitly blocks [cross-origin resource sharing](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS), we won't be able to display your site on the TV. To fix this, you need to modify or remove the HTTP [X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options) response header on your server.

## What time block should I pick?

That's up to you! Times are stored in Coordinated Universal Time (UTC), so if you want your site to air at a particular _local_ time, make sure you translate the time between local and UTC first. Here's a helpful [conversion tool for UTC to local time](https://dateful.com/convert/utc).

Programs can only be scheduled at `:00` or `:30`. Programs will air continuously until the next scheduled program or the end of the day, whichever is first.

## Can I submit more than one site?

If you have multiple sites that meet the criteria, please do!

## I have a site I want to add, but I'm not sure how to submit through GitHub. Is there another way?

Send me an email (hey@evadecker.com) with your website, channel, and requested time, and I'll add it!