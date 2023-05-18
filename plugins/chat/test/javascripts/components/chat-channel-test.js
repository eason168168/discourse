import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import hbs from "htmlbars-inline-precompile";
import fabricators from "discourse/plugins/chat/discourse/lib/fabricators";
import { render, waitFor } from "@ember/test-helpers";
import { module, test } from "qunit";
import pretender, { OK } from "discourse/tests/helpers/create-pretender";
import { publishToMessageBus } from "discourse/tests/helpers/qunit-helpers";

module(
  "Discourse Chat | Component | chat-channel | status on mentions",
  function (hooks) {
    setupRenderingTest(hooks);

    const channelId = 1;
    const actingUser = {
      id: 1,
      username: "acting_user",
    };
    const mentionedUser = {
      id: 1000,
      username: "user1",
      status: {
        description: "surfing",
        emoji: "surfing_man",
      },
    };
    const mentionedUser2 = {
      id: 2000,
      username: "user2",
      status: {
        description: "vacation",
        emoji: "desert_island",
      },
    };
    const messagesResponse = {
      meta: {
        channel_id: channelId,
      },
      chat_messages: [
        {
          id: 1891,
          message: `Hey @${mentionedUser.username}`,
          cooked: `<p>Hey <a class="mention" href="/u/${mentionedUser.username}">@${mentionedUser.username}</a></p>`,
          mentioned_users: [mentionedUser],
          user: {
            id: 1,
            username: "jesse",
          },
        },
      ],
    };

    hooks.beforeEach(function () {
      pretender.get(`/chat/${channelId}/messages`, () => OK(messagesResponse));

      this.channel = fabricators.channel({
        id: channelId,
        currentUserMembership: { following: true },
        meta: { can_join_chat_channel: false },
      });
      this.appEvents = this.container.lookup("service:appEvents");
    });

    test("it shows status on mentions", async function (assert) {
      await render(hbs`<ChatChannel @channel={{this.channel}} />`);

      assertStatusIsRendered(
        assert,
        statusSelector(mentionedUser.username),
        mentionedUser.status
      );
    });

    test("it updates status on mentions", async function (assert) {
      await render(hbs`<ChatChannel @channel={{this.channel}} />`);

      const newStatus = {
        description: "off to dentist",
        emoji: "tooth",
      };

      this.appEvents.trigger("user-status:changed", {
        [mentionedUser.id]: newStatus,
      });

      const selector = statusSelector(mentionedUser.username);
      await waitFor(selector);
      assertStatusIsRendered(
        assert,
        statusSelector(mentionedUser.username),
        newStatus
      );
    });

    test("it deletes status on mentions", async function (assert) {
      await render(hbs`<ChatChannel @channel={{this.channel}} />`);

      this.appEvents.trigger("user-status:changed", {
        [mentionedUser.id]: null,
      });

      const selector = statusSelector(mentionedUser.username);
      await waitFor(selector, { count: 0 });
      assert.dom(selector).doesNotExist("status is deleted");
    });

    test("it shows status on mentions on messages that came from Message Bus", async function (assert) {
      await render(hbs`<ChatChannel @channel={{this.channel}} />`);

      await receiveMessageViaMessageBus();

      assertStatusIsRendered(
        assert,
        statusSelector(mentionedUser2.username),
        mentionedUser2.status
      );
    });

    test("it updates status on mentions on messages that came from Message Bus", async function (assert) {
      await render(hbs`<ChatChannel @channel={{this.channel}} />`);
      await receiveMessageViaMessageBus();

      const newStatus = {
        description: "off to meeting",
        emoji: "calendar",
      };
      this.appEvents.trigger("user-status:changed", {
        [mentionedUser2.id]: newStatus,
      });

      const selector = statusSelector(mentionedUser2.username);
      await waitFor(selector);
      assertStatusIsRendered(
        assert,
        statusSelector(mentionedUser2.username),
        newStatus
      );
    });

    test("it deletes status on mentions on messages that came from Message Bus", async function (assert) {
      await render(hbs`<ChatChannel @channel={{this.channel}} />`);
      await receiveMessageViaMessageBus();

      this.appEvents.trigger("user-status:changed", {
        [mentionedUser2.id]: null,
      });

      const selector = statusSelector(mentionedUser2.username);
      await waitFor(selector, { count: 0 });
      assert.dom(selector).doesNotExist("status is deleted");
    });

    function assertStatusIsRendered(assert, selector, status) {
      assert
        .dom(selector)
        .exists("status is rendered")
        .hasAttribute(
          "title",
          status.description,
          "status description is updated"
        )
        .hasAttribute(
          "src",
          new RegExp(`${status.emoji}.png`),
          "status emoji is updated"
        );
    }

    async function receiveMessageViaMessageBus() {
      await publishToMessageBus(`/chat/${channelId}`, {
        chat_message: {
          id: 2138,
          message: `Hey @${mentionedUser2.username}`,
          cooked: `<p>Hey <a class="mention" href="/u/${mentionedUser2.username}">@${mentionedUser2.username}</a></p>`,
          created_at: "2023-05-18T16:07:59.588Z",
          excerpt: `Hey @${mentionedUser2.username}`,
          available_flags: [],
          thread_title: null,
          chat_channel_id: 7,
          mentioned_users: [mentionedUser2],
          user: actingUser,
          chat_webhook_event: null,
          uploads: [],
        },
        type: "sent",
      });
    }

    function statusSelector(username) {
      return `.mention[href='/u/${username}'] .user-status`;
    }
  }
);
