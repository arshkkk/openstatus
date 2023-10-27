"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { InsertNotification } from "@openstatus/db/src/schema";
import {
  insertNotificationSchema,
  notificationProvider,
  notificationProviderSchema,
} from "@openstatus/db/src/schema";
import { sendTestDiscordMessage } from "@openstatus/notification-discord";
import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { useToastAction } from "@/hooks/use-toast-action";
import { api } from "@/trpc/client";

/**
 * TODO: based on the providers `data` structure, create dynamic form inputs
 * e.g. Provider: Email will need an `email` input field and
 * we store it like `data: { email: "" }`
 * But Provider: Slack will maybe require `webhook` and `channel` and
 * we store it like `data: { webhook: "", channel: "" }`
 */

interface Props {
  defaultValues?: InsertNotification;
  workspaceSlug: string;
  onSubmit?: () => void;
}

function getDefaultProviderData(defaultValues?: InsertNotification) {
  if (defaultValues?.provider === "email") {
    return JSON.parse(defaultValues?.data).email;
  } else if (defaultValues?.provider === "discord") {
    return JSON.parse(defaultValues?.data).discord;
  }
  return "";
}

function setProviderData(
  provider: "email" | "discord" | "slack",
  data: string,
) {
  switch (provider) {
    case "email":
      return { email: data };
    case "discord":
      return { discord: data };
    default:
      return {};
  }
}

export function NotificationForm({
  workspaceSlug,
  defaultValues,
  onSubmit: onExternalSubmit,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [isTestPending, startTestTransition] = useTransition();
  const { toast } = useToastAction();
  const router = useRouter();
  const form = useForm<InsertNotification>({
    resolver: zodResolver(insertNotificationSchema),
    defaultValues: {
      ...defaultValues,
      name: defaultValues?.name || "",
      data: getDefaultProviderData(defaultValues),
    },
  });
  const watchProvider = form.watch("provider");

  async function onSubmit({ provider, data, ...rest }: InsertNotification) {
    startTransition(async () => {
      try {
        if (defaultValues) {
          await api.notification.updateNotification.mutate({
            provider,
            data: JSON.stringify(setProviderData(provider, data)),
            ...rest,
          });
        } else {
          await api.notification.createNotification.mutate({
            workspaceSlug,
            provider,
            data: JSON.stringify(setProviderData(provider, data)),
            ...rest,
          });
        }
        router.refresh();
        toast("saved");
      } catch {
        toast("error");
      } finally {
        onExternalSubmit?.();
      }
    });
  }

  async function sendTestWebhookPing() {
    startTestTransition(async () => {
      const isSuccessful = await sendTestDiscordMessage(form.getValues("data"));
      if (isSuccessful) {
        toast("success");
        return;
      }
      toast("test-error");
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid w-full gap-6"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="my-1.5 flex flex-col gap-2">
            <p className="text-sm font-semibold leading-none">Alerts</p>
            <p className="text-muted-foreground text-sm">
              Select the notification channels you want to be informed.
            </p>
          </div>
          <div className="grid gap-6 sm:col-span-2 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem className="sm:col-span-1 sm:self-baseline">
                  <FormLabel>Provider</FormLabel>
                  <Select
                    onValueChange={(value) =>
                      field.onChange(notificationProviderSchema.parse(value))
                    }
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="capitalize">
                        <SelectValue placeholder="Select Provider" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {notificationProvider.map((provider) => (
                        <SelectItem
                          key={provider}
                          value={provider}
                          disabled={provider === "slack"} // disable slack for now
                          className="capitalize"
                        >
                          {provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    What channel/provider to send a notification.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-1 sm:self-baseline">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Dev Team" {...field} />
                  </FormControl>
                  <FormDescription>
                    Define a name for the channel.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {watchProvider && (
              <FormField
                control={form.control}
                name="data"
                render={({ field }) => (
                  <FormItem className="sm:col-span-full">
                    {/* make the first letter capital */}
                    <div className="flex items-center justify-between">
                      <FormLabel>
                        {watchProvider[0].toUpperCase() +
                          watchProvider.slice(1)}
                      </FormLabel>
                    </div>
                    <FormControl>
                      <Input
                        type={watchProvider === "email" ? "email" : "url"}
                        placeholder={
                          watchProvider === "email"
                            ? "dev@documenso.com"
                            : "https://your-discord-webhook-url"
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="flex items-center justify-between">
                      The data required.
                      <span>
                        {watchProvider !== "email" && (
                          <a
                            href={`https://docs.openstatus.dev/integrations/${watchProvider}`}
                            target="_blank"
                            className="underline"
                          >
                            How to setup your {watchProvider} webhook
                          </a>
                        )}
                      </span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </div>
        <div className="flex gap-4 sm:justify-end">
          {watchProvider && watchProvider !== "email" && (
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              size="lg"
              onClick={sendTestWebhookPing}
            >
              {!isTestPending ? (
                "Test Webhook"
              ) : (
                <LoadingAnimation variant="inverse" />
              )}
            </Button>
          )}
          <Button
            className="w-full sm:w-auto"
            size="lg"
            disabled={isPending || !watchProvider}
          >
            {!isPending ? "Confirm" : <LoadingAnimation />}
          </Button>
        </div>
      </form>
    </Form>
  );
}
