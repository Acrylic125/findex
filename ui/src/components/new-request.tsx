"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useMemo, useRef, useState } from "react";
import { Button } from "./ui/button";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDebounce } from "use-debounce";
import Fuse from "fuse.js";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItemBase,
  CommandList,
} from "./ui/command";
import { ChevronsUpDown, Plus } from "lucide-react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type Course = {
  id: number;
  code: string;
  name: string;
};

function SelectCourseCommand({
  value,
  onChange,
  courses,
  //   programs,
  //   limit,
}: {
  value: Course | null;
  onChange: (value: Course) => void;
  courses: Course[];
  //   limit: number;
}) {
  //   const serializedPrograms = useMemo(() => {
  //     return value.map(serializeProgram);
  //   }, [value]);

  const parentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);

  const fuse = useMemo(() => {
    return new Fuse(courses, {
      keys: [
        {
          name: "name",
          weight: 1,
        },
        {
          name: "code",
          weight: 2,
        },
      ],
    });
  }, [courses]);

  const filteredOptions = useMemo(() => {
    if (parentRef.current) {
      parentRef.current.scrollTo({
        top: 0,
        behavior: "instant",
      });
    }
    if (debouncedSearch === "") {
      return courses;
    }
    return fuse.search(debouncedSearch).map((r) => r.item);
  }, [fuse, debouncedSearch, parentRef]);

  const virtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
  });

  const virtualOptions = virtualizer.getVirtualItems();

  return (
    <Command shouldFilter={false}>
      <CommandInput
        placeholder="Search program..."
        className="h-10 text-base"
        onValueChange={setSearch}
        ref={inputRef}
      />
      <CommandList
        ref={parentRef}
        style={{
          // height: `200px`,
          width: "100%",
          overflow: "auto",
        }}
      >
        <CommandEmpty>No course found.</CommandEmpty>
        <CommandGroup
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
          className="p-0"
        >
          {virtualOptions.map((virtualItem) => {
            const course = filteredOptions[virtualItem.index];
            // const serialized = serializeProgram(program);
            // const isSelected = serializedPrograms.includes(serialized);
            return (
              <CommandItemBase
                key={course.id}
                value={course.id.toString()}
                onSelect={() => {
                  onChange(course);
                  inputRef.current?.focus();
                }}
                style={{
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className="py-0 absolute top-0 left-0 right-0"
                selected={value?.id === course.id}
                // disabled={!isSelected && value.length >= limit}
              >
                <div className="py-1.5 px-2 w-full truncate">
                  {course.code} {course.name}
                </div>
              </CommandItemBase>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

export function SelectCourseCombobox({
  value,
  onChange,
  courses,
  // limit,
  disabled,
}: {
  value: Course | null;
  onChange: (value: Course) => void;
  courses: Course[];
  // limit: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* <PopoverTrigger asChild>
          
          <div className="flex-row w-full h-12 bg-input/30 border border-input rounded-md flex items-center justify-between px-3">
          </div>
        </PopoverTrigger> */}
      <Button
        variant="ghost"
        className="flex-row w-full h-12 border border-input rounded-md flex items-center justify-between px-3 truncate"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span
          className={cn("flex flex-row gap-2", {
            "text-foreground": value !== null,
            "text-muted-foreground": value === null,
          })}
        >
          {value !== null
            ? `${value.code} ${value.name}`
            : "No Course Specified"}
        </span>
        <div className="flex flex-row gap-2 items-center">
          <ChevronsUpDown className="opacity-50" />
        </div>
      </Button>
      {/* https://github.com/shadcn-ui/ui/issues/1690 */}
      {/* <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]"> */}
      <PopoverContent className="p-0 w-full">
        <SelectCourseCommand
          value={value}
          onChange={onChange}
          courses={courses}
        />
      </PopoverContent>
    </Popover>
  );
}

export function NewRequest({ courses }: { courses: Course[] }) {
  const [open, setOpen] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="default" size="lg" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New Swap
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Swap</DialogTitle>
          <DialogDescription>
            Which course do you want to swap?
          </DialogDescription>
        </DialogHeader>
        {/* <Combobox
          items={courses}
          itemToStringValue={(course: Course) => `${course.code} ${course.name}`}
          filter={}
        >
          <ComboboxInput placeholder="Select a framework" />
          <ComboboxContent>
            <ComboboxEmpty>No items found.</ComboboxEmpty>
            <ComboboxList>
              {(framework) => (
                <ComboboxItem key={framework.value} value={framework}>
                  {framework.label}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox> */}
        <SelectCourseCombobox
          value={course}
          onChange={setCourse}
          courses={courses}
        />
        <DialogFooter className="flex flex-row gap-2 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={course === null}
            variant="default"
            onClick={() => {
              if (course) {
                router.push(`/app/request/${course.code}`);
              }
            }}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
